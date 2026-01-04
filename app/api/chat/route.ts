import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3-lite'

// Google Custom Search API - DISABLED (replaced with Claude suggestions)
// const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
// const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID

// Configuration
const SIMILARITY_THRESHOLD = 0.82  // Higher = stricter matching (was 0.75, increased for accuracy)
const SIMILARITY_THRESHOLD_LOW = 0.70  // Lower threshold for fallback (with text filter)
const MAX_SUGGESTIONS = 3          // Max number of song suggestions (could be 1-3)

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[] }>
}

// Grouped song result (for multi-page and key variants)
interface GroupedSongResult {
  id: string
  title: string
  pages: Array<{
    id: string
    image_url: string
    original_filename: string
    ocr_text: string
    song_key?: string
    similarity?: number
    matchType?: ScoredResult['matchType']
    matchedOn?: string
  }>
  availableKeys: string[]
  selectedKey?: string
  totalPages: number
}

// Database record type
interface SongImageRecord {
  id: string
  image_url: string
  original_filename: string
  ocr_text: string
  song_title?: string  // Clean title extracted by Claude Vision
  song_key?: string
  song_group_id?: string
  page_number?: number
  similarity?: number
}

// Normalize Korean text for better matching
function normalizeKorean(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFC')           // Unicode normalization
    .replace(/\s+/g, '')        // Remove ALL spaces
    .toLowerCase()
}

// Calculate similarity score between two strings (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeKorean(str1)
  const s2 = normalizeKorean(str2)

  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) return 0.9

  // Calculate character overlap
  const chars1 = new Set(s1.split(''))
  const chars2 = new Set(s2.split(''))
  const intersection = [...chars1].filter(c => chars2.has(c)).length
  const union = new Set([...chars1, ...chars2]).size

  return union > 0 ? intersection / union : 0
}

// Search result with score
interface ScoredResult {
  id: string
  image_url: string
  original_filename: string
  ocr_text: string
  song_title?: string
  song_key?: string
  score: number
  matchType: 'exact' | 'normalized' | 'alias' | 'fuzzy' | 'vector'
  matchedOn?: string  // What text was matched (e.g., "Holy Forever" for alias match)
}

// Check if song title or OCR text contains keywords from query (for filtering results)
function hasTextOverlap(ocrText: string, query: string, songTitle?: string): boolean {
  if (!query) return false

  const queryLower = query.toLowerCase()

  // Remove common filler words
  const fillerWords = ['악보', '코드', 'sheet', 'chord', '찾아줘', '찾아', '주세요', '줘', '키', 'key', 'find', 'search']
  let cleanQuery = queryLower
  for (const filler of fillerWords) {
    cleanQuery = cleanQuery.replace(new RegExp(filler, 'gi'), '')
  }
  cleanQuery = cleanQuery.trim()

  if (cleanQuery.length < 2) return true // Query too short after cleaning, accept all

  // PRIORITY 1: Check clean song_title (most accurate)
  if (songTitle) {
    const titleLower = songTitle.toLowerCase()
    // Exact or partial match on clean title
    if (titleLower.includes(cleanQuery) || cleanQuery.includes(titleLower)) {
      return true
    }
    // Check for token matches in title
    const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length >= 2)
    for (const token of queryTokens) {
      if (titleLower.includes(token)) {
        return true
      }
    }
    // Check Korean characters without spaces (normalized)
    const titleNorm = normalizeKorean(titleLower)
    const queryNorm = normalizeKorean(cleanQuery)
    if (queryNorm.length >= 2 && titleNorm.includes(queryNorm)) {
      return true
    }
  }

  // PRIORITY 2: Fall back to OCR text if no song_title match
  if (!ocrText) return false

  const ocrLower = ocrText.toLowerCase()

  // Split query into words/tokens
  const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length >= 2)

  if (queryTokens.length === 0) return true

  // Check if any significant token from query exists in OCR text
  for (const token of queryTokens) {
    if (ocrLower.includes(token)) {
      return true
    }
  }

  // Also check normalized Korean
  const queryNorm = normalizeKorean(cleanQuery)
  const ocrNorm = normalizeKorean(ocrLower)
  if (queryNorm.length >= 2 && ocrNorm.includes(queryNorm)) {
    return true
  }

  return false
}

// Extract clean search terms from user query
function extractSearchTerms(query: string): string {
  const fillerWords = ['악보', '코드', 'sheet', 'chord', '찾아줘', '찾아', '주세요', '줘', '키', 'key', 'find', 'search', '가사', 'lyrics']
  let clean = query.toLowerCase()
  for (const filler of fillerWords) {
    clean = clean.replace(new RegExp(filler, 'gi'), '')
  }
  return clean.trim()
}

// Detect if user is asking for songs by key (e.g., "A 코드 찬양리스트", "G키 찬양")
interface KeyQuery {
  isKeyQuery: boolean
  requestedKey?: string
  songQuery?: string
}

function detectKeyQuery(message: string): KeyQuery {
  // Common key patterns: A, B, C, D, E, F, G with optional #, b, m
  const keyPatterns = [
    // Korean: "A 코드 찬양", "G키 찬양", "C 키 악보"
    /([A-Ga-g][#b]?m?)\s*(코드|키|key)\s*(찬양|악보|리스트|목록|곡|노래)?/i,
    // Korean: "A코드 찬양리스트"
    /([A-Ga-g][#b]?m?)(코드|키)\s*(찬양|악보|리스트|목록|곡|노래)?/i,
    // English: "key of A", "in A key", "A key songs"
    /(key\s*of\s*|in\s*)([A-Ga-g][#b]?m?)/i,
    /([A-Ga-g][#b]?m?)\s*key\s*(songs?|sheets?|list)?/i,
    // Just key at start: "A 찬양", "G 악보"
    /^([A-Ga-g][#b]?m?)\s+(찬양|악보|곡)/i,
  ]

  for (const pattern of keyPatterns) {
    const match = message.match(pattern)
    if (match) {
      // Extract the key (usually group 1 or 2)
      const key = match[1] || match[2]
      if (key && key.length <= 3) {  // Valid key format
        return {
          isKeyQuery: true,
          requestedKey: key.toUpperCase(),
          songQuery: message.replace(pattern, '').trim(),
        }
      }
    }
  }

  return { isKeyQuery: false }
}

// Extract key from user query for specific song (e.g., "Holy Forever G키")
function extractRequestedKey(message: string): string | null {
  const patterns = [
    /([A-Ga-g][#b]?m?)\s*(키|코드|key)/i,
    /(키|코드|key)\s*([A-Ga-g][#b]?m?)/i,
    /\s([A-Ga-g][#b]?m?)$/i,  // Key at end of message
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) {
      const key = match[1] || match[2]
      if (key && /^[A-Ga-g][#b]?m?$/.test(key)) {
        return key.toUpperCase()
      }
    }
  }
  return null
}

// Extract song title from OCR text (first meaningful line)
function extractSongTitle(ocrText?: string): string {
  if (!ocrText) return ''

  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean)

  // Skip common non-title lines
  const skipPatterns = [/^key/i, /^키/i, /^capo/i, /^\d+$/, /^[A-G][#b]?m?$/]

  for (const line of lines) {
    // Skip very short lines or lines that are just key indicators
    if (line.length < 2 || line.length > 50) continue
    if (skipPatterns.some(p => p.test(line))) continue

    // Return the first valid title line
    return line.toLowerCase().replace(/[^\w\s가-힣]/g, '').trim()
  }

  return lines[0]?.toLowerCase().substring(0, 30) || ''
}

// Detect if user is asking for a specific song (not key list)
function isSpecificSongQuery(message: string): boolean {
  const specificSongPatterns = [
    // Song names in Korean/English
    /거룩\s*영원히/i,
    /holy\s*forever/i,
    /주님이\s*주신/i,
    /전능하신/i,
    // General patterns for song search
    /악보\s*찾/i,
    /찾아\s*줘/i,
    /찾아줘/i,
    /악보/i,
    // English patterns
    /find\s*sheet/i,
    /chord\s*sheet/i,
  ]

  // If it's a key list query like "A코드 찬양리스트", return false
  if (/[A-Ga-g][#b]?m?\s*(코드|키)\s*(찬양|악보)?\s*(리스트|목록)/i.test(message)) {
    return false
  }

  // Check for specific song patterns
  return specificSongPatterns.some(p => p.test(message)) ||
    // Or if message is just a song name (2-30 chars, no question marks)
    (message.length >= 2 && message.length <= 40 && !message.includes('?'))
}

// Extract base filename for grouping multi-page sheets
// e.g., "Holy_Forever_1.jpg" -> "holy_forever"
// e.g., "Holy Forever (2).jpg" -> "holy forever"
// e.g., "TalkMedia_i_54d97c7950f2 2.jpeg.jpeg" -> "talkmedia_i_54d97c7950f2"
function getBaseFilename(filename: string): string {
  let base = filename.toLowerCase()

  // Remove all extensions (handles double extensions like .jpeg.jpeg)
  base = base.replace(/(\.(jpg|jpeg|png|gif|webp))+$/i, '')

  // Remove page number patterns - MUST have separator before number:
  // " 2", "_2", " (2)", "_(2)" - requires space or underscore before
  base = base
    .replace(/[\s_]+\(?(\d+)\)?$/, '')         // " 2", "_2", " (2)", "_(2)" - REQUIRES separator
    .replace(/[\s_]*(page|p)[\s_]*\d+$/i, '')  // "page1", "p2", "_page_2"
    .trim()

  return base
}

// Find related pages for a given result (multi-page sheet detection)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findRelatedPages(
  supabase: any,
  result: { id: string; original_filename: string; song_group_id?: string; song_title?: string },
  allResultIds: Set<string>
): Promise<SongImageRecord[]> {
  const relatedPages: SongImageRecord[] = []

  const baseFilename = getBaseFilename(result.original_filename)
  const songTitle = result.song_title?.toLowerCase().trim()

  console.log(`[findRelatedPages] Looking for related pages:`)
  console.log(`  - Original: ${result.original_filename}`)
  console.log(`  - Base: ${baseFilename}`)
  console.log(`  - Song title: ${songTitle}`)

  // Strategy 1: Check by song_group_id if it exists
  if (result.song_group_id) {
    const { data } = await supabase
      .from('song_images')
      .select('*')
      .eq('song_group_id', result.song_group_id)
      .neq('id', result.id)
      .limit(10)

    if (data && Array.isArray(data)) {
      const typedData = data as SongImageRecord[]
      relatedPages.push(...typedData.filter(r => !allResultIds.has(r.id)))
    }
  }

  // Strategy 2: Find by similar filename pattern + SAME song title
  // This ensures we only get pages from the SAME version of the song
  if (baseFilename.length > 3) {
    // Extract the unique ID part of filename (e.g., "54d97c7950f2" from "TalkMedia_i_54d97c7950f2")
    const parts = baseFilename.split('_')
    const searchPattern = parts.length > 2 ? parts[parts.length - 1] : baseFilename

    console.log(`  - Search pattern: ${searchPattern}`)

    const { data, error } = await supabase
      .from('song_images')
      .select('*')
      .ilike('original_filename', `%${searchPattern}%`)
      .neq('id', result.id)
      .limit(10)

    if (error) {
      console.log(`  - Error: ${error.message}`)
    }

    if (data && Array.isArray(data)) {
      const typedData = data as SongImageRecord[]
      console.log(`  - Found ${typedData.length} potential matches`)

      // Filter to only include pages that:
      // 1. Match the base filename pattern
      // 2. Have the SAME song title (to avoid mixing different songs uploaded together)
      const filtered = typedData.filter(r => {
        const rBase = getBaseFilename(r.original_filename)
        const baseMatches = rBase === baseFilename

        // Require matching song titles to be included
        // Pages with null/missing titles are excluded (can't verify they're the same song)
        const rTitle = r.song_title?.toLowerCase().trim()
        const hasValidTitle = rTitle && rTitle !== 'null'
        const songHasValidTitle = songTitle && songTitle !== 'null'

        // Only include if both have valid titles AND they match
        // This prevents mixing different songs that were uploaded together
        const titleMatches = hasValidTitle && songHasValidTitle && songTitle === rTitle

        const include = baseMatches && titleMatches
        console.log(`    - ${r.original_filename} | base: ${baseMatches}, title: ${titleMatches} (${rTitle || 'null'}) => ${include}`)
        return include
      })

      relatedPages.push(...filtered)
      console.log(`  - After filtering: ${filtered.length} related pages`)
    }
  }

  // Sort by filename to get page order
  relatedPages.sort((a, b) => a.original_filename.localeCompare(b.original_filename))

  // Remove duplicates
  const seen = new Set<string>()
  return relatedPages.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
}

// Google Image Search - REMOVED (was returning random images, not chord sheets)
// Replaced with Claude suggestions for better user experience

// Detect if user needs Claude assistance (not a simple search)
function needsClaudeAssist(message: string): boolean {
  const helpPatterns = [
    // Korean help indicators
    '다시', '아니', '틀렸', '다른', '도움', '뭐가', '왜', '어떻게', '설명',
    // English help indicators
    'wrong', 'not', 'help', 'different', 'why', 'how', 'explain', 'again',
    // Questions
    '?',
  ]

  const lowerMessage = message.toLowerCase()
  return helpPatterns.some(pattern => lowerMessage.includes(pattern))
}

// Generate smart response based on results (cost-free)
interface SmartResponseOptions {
  results: Array<{ ocr_text?: string; song_key?: string; original_filename?: string; song_title?: string }>
  searchQuery: string
  isKorean: boolean
  isKeyListQuery?: boolean
  requestedKey?: string
  availableKeyVariants?: string[]
  needsKeySelection?: boolean
}

function generateSmartResponse(options: SmartResponseOptions): string {
  const { results, searchQuery, isKorean, isKeyListQuery, requestedKey, availableKeyVariants, needsKeySelection } = options

  if (results.length === 0) {
    if (isKeyListQuery && requestedKey) {
      return isKorean
        ? `${requestedKey} 키의 악보가 없습니다. 다른 키로 검색해 보세요.`
        : `No sheets found in key ${requestedKey}. Try a different key.`
    }
    return isKorean
      ? '검색 결과가 없습니다. 다른 키워드로 검색해 보세요.'
      : 'No results found. Try different keywords.'
  }

  // Key list query response (e.g., "A 코드 찬양리스트")
  if (isKeyListQuery && requestedKey) {
    // Use clean song_title when available
    const titles = results
      .map(r => r.song_title || r.ocr_text?.split('\n')[0]?.substring(0, 25) || '')
      .filter(Boolean)
      .slice(0, 5)

    return isKorean
      ? `🎵 ${requestedKey} 키 악보 ${results.length}개:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
      : `🎵 ${results.length} sheets in key ${requestedKey}:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
  }

  // Get song title from first result - prefer clean song_title
  const songTitle = results[0]?.song_title || results[0]?.ocr_text?.split('\n')[0]?.substring(0, 30) || searchQuery

  // If we need to ask for key selection
  if (needsKeySelection && availableKeyVariants && availableKeyVariants.length > 1) {
    const keyList = availableKeyVariants.join(', ')
    return isKorean
      ? `'${songTitle}' 악보를 찾았습니다!\n🎵 사용 가능한 키: ${keyList}\n어떤 키로 보시겠어요?`
      : `Found '${songTitle}'!\n🎵 Available keys: ${keyList}\nWhich key would you like?`
  }

  // Extract available keys from results
  const keys = results
    .map(r => r.song_key)
    .filter((k): k is string => !!k && k.trim() !== '')
  const uniqueKeys = [...new Set(keys)]

  if (results.length === 1) {
    const keyInfo = uniqueKeys.length > 0 ? ` (${uniqueKeys[0]})` : ''
    return isKorean
      ? `'${songTitle}'${keyInfo} 악보입니다. 이미지를 탭하여 크게 보거나 다운로드하세요.`
      : `Found '${songTitle}'${keyInfo}. Tap to view or download.`
  }

  // Multiple results - show available keys
  if (uniqueKeys.length > 1) {
    const keyList = uniqueKeys.join(', ')
    return isKorean
      ? `'${songTitle}' 악보 ${results.length}개를 찾았습니다.\n🎵 키: ${keyList}\n원하시는 키를 선택하세요.`
      : `Found ${results.length} sheets for '${songTitle}'.\n🎵 Keys: ${keyList}\nSelect your preferred key.`
  }

  if (uniqueKeys.length === 1) {
    return isKorean
      ? `'${songTitle}' (${uniqueKeys[0]}) 악보입니다.`
      : `Found '${songTitle}' (${uniqueKeys[0]}).`
  }

  return isKorean
    ? `'${songTitle}' 악보를 찾았습니다.`
    : `Found sheets for '${songTitle}'.`
}

// Group search results by song version (combines multi-page sheets, but keeps different versions separate)
function groupResultsBySong(
  results: Array<{
    id: string
    image_url: string
    original_filename: string
    ocr_text: string
    song_title?: string  // Clean title from Claude Vision
    song_key?: string
    similarity?: number
    matchType?: ScoredResult['matchType']
    matchedOn?: string
  }>,
  requestedKey?: string
): GroupedSongResult[] {
  const songMap = new Map<string, GroupedSongResult>()

  for (const result of results) {
    // Use clean song_title from Claude Vision, fallback to OCR extraction
    const title = result.song_title?.toLowerCase().trim() ||
                  extractSongTitle(result.ocr_text) ||
                  getBaseFilename(result.original_filename)

    // Get the base filename to identify the specific VERSION of the song
    // This separates different uploads of the same song
    const baseFilename = getBaseFilename(result.original_filename)

    // Group key: combine title + base filename pattern
    // This keeps multi-page sheets together, but separates different versions
    const groupKey = `${title}::${baseFilename}`

    if (!songMap.has(groupKey)) {
      songMap.set(groupKey, {
        id: result.id,
        title,
        pages: [],
        availableKeys: [],
        totalPages: 0,
      })
    }

    const group = songMap.get(groupKey)!

    // Add page to the group
    group.pages.push(result)
    group.totalPages++

    // Track the song's key (use first page's key, don't collect multiple)
    // A song has ONE key, not multiple
    if (result.song_key && group.availableKeys.length === 0) {
      group.availableKeys.push(result.song_key)
    }
  }

  // Convert to array and filter by requested key if specified
  let grouped = Array.from(songMap.values())

  // If a key is requested, filter pages to only show that key
  if (requestedKey) {
    grouped = grouped.map(g => {
      const filteredPages = g.pages.filter(p =>
        p.song_key?.toUpperCase() === requestedKey.toUpperCase()
      )

      // If no pages match the key, keep original (might be pages without key info)
      if (filteredPages.length === 0) return g

      return {
        ...g,
        pages: filteredPages,
        selectedKey: requestedKey.toUpperCase(),
        totalPages: filteredPages.length,
      }
    })
  }

  // Sort by: 1) More pages first (more complete), 2) Has key info, 3) Similarity score
  grouped.sort((a, b) => {
    // Priority 1: More pages = more complete version
    if (b.totalPages !== a.totalPages) {
      return b.totalPages - a.totalPages
    }

    // Priority 2: Has key information
    const aHasKey = a.availableKeys.length > 0 ? 1 : 0
    const bHasKey = b.availableKeys.length > 0 ? 1 : 0
    if (bHasKey !== aHasKey) {
      return bHasKey - aHasKey
    }

    // Priority 3: Best similarity score
    const aScore = Math.max(...a.pages.map(p => p.similarity || 0))
    const bScore = Math.max(...b.pages.map(p => p.similarity || 0))
    return bScore - aScore
  })

  // Deduplicate: Keep only the BEST version of each song (by title)
  // This removes inferior versions (fewer pages) of the same song
  const bestByTitle = new Map<string, GroupedSongResult>()
  for (const group of grouped) {
    const normalizedTitle = group.title.toLowerCase().trim()
    if (!bestByTitle.has(normalizedTitle)) {
      // First (best) version of this song - keep it
      bestByTitle.set(normalizedTitle, group)
    }
    // Skip inferior versions of the same song
  }
  grouped = Array.from(bestByTitle.values())

  // Sort pages within each group by filename (for page order)
  grouped.forEach(g => {
    g.pages.sort((a, b) => a.original_filename.localeCompare(b.original_filename))
  })

  return grouped
}

// Detect if message is primarily Korean
function isKoreanMessage(message: string): boolean {
  const koreanRegex = /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/g
  const koreanChars = message.match(koreanRegex) || []
  return koreanChars.length > message.length * 0.3
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: text,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voyage AI API error: ${response.status} - ${error}`)
  }

  const data: VoyageEmbeddingResponse = await response.json()
  return data.data[0].embedding
}

export async function POST(request: NextRequest) {
  try {
    const { message, language, history } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Parse conversation history for context
    const conversationHistory = Array.isArray(history) ? history : []

    const supabase = createClient(supabaseUrl, supabaseKey)
    // Use language setting if provided, otherwise auto-detect
    const isKorean = language === 'en' ? false : (language === 'ko' ? true : isKoreanMessage(message))
    const needsHelp = needsClaudeAssist(message)
    const isSpecificSong = isSpecificSongQuery(message)

    // Check for key-based queries (e.g., "A 코드 찬양리스트")
    const keyQuery = detectKeyQuery(message)
    const requestedKey = keyQuery.requestedKey || extractRequestedKey(message)

    let searchResults: Array<{
      id: string
      image_url: string
      original_filename: string
      ocr_text: string
      song_title?: string  // Clean title from Claude Vision
      song_key?: string
      similarity?: number
      matchType?: ScoredResult['matchType']
      matchedOn?: string
    }> = []

    // CASE 1: Key list query (e.g., "A 코드 찬양리스트")
    if (keyQuery.isKeyQuery && keyQuery.requestedKey) {
      console.log(`[Key Query] Looking for songs in key: ${keyQuery.requestedKey}`)

      // Search for all songs with the requested key using song_key field
      const { data, error } = await supabase
        .from('song_images')
        .select('*')
        .ilike('song_key', `%${keyQuery.requestedKey}%`)
        .limit(20)

      if (!error && data) {
        // Filter to only include songs where key matches precisely
        searchResults = data.filter(r => {
          const key = r.song_key?.toUpperCase() || ''
          const requestedKeyUpper = keyQuery.requestedKey!.toUpperCase()
          return key === requestedKeyUpper || key.startsWith(requestedKeyUpper)
        })
        console.log(`[Key Query] Found ${searchResults.length} songs in key ${keyQuery.requestedKey}`)
      }
    }
    // CASE 2: Normal song search - PARALLEL SCORING APPROACH
    else {
      const cleanSearchTerms = extractSearchTerms(message)
      const normalizedQuery = normalizeKorean(cleanSearchTerms)
      console.log(`[Search] Query: "${message}" -> Clean: "${cleanSearchTerms}" -> Normalized: "${normalizedQuery}"`)

      // Run multiple search methods in PARALLEL and combine with scores
      const scoredResults: ScoredResult[] = []

      // Helper to add scored results (avoiding duplicates)
      const addScoredResults = (
        results: SongImageRecord[],
        score: number,
        matchType: ScoredResult['matchType'],
        matchedOn?: string  // What text was matched (for alias/fuzzy matches)
      ) => {
        for (const r of results) {
          // Check if already exists with higher score
          const existing = scoredResults.find(sr => sr.id === r.id)
          if (existing) {
            if (score > existing.score) {
              existing.score = score
              existing.matchType = matchType
              existing.matchedOn = matchedOn || r.song_title
            }
          } else {
            scoredResults.push({
              id: r.id,
              image_url: r.image_url,
              original_filename: r.original_filename,
              ocr_text: r.ocr_text,
              song_title: r.song_title,
              song_key: r.song_key,
              score,
              matchType,
              matchedOn: matchedOn || r.song_title,
            })
          }
        }
      }

      if (cleanSearchTerms.length >= 2) {
        // PARALLEL SEARCH 1: Exact title match (highest priority)
        const exactMatchPromise = supabase
          .from('song_images')
          .select('*')
          .ilike('song_title', `%${cleanSearchTerms}%`)
          .limit(10)

        // PARALLEL SEARCH 2: Normalized Korean match (handle spacing)
        const normalizedMatchPromise = supabase
          .from('song_images')
          .select('*')
          .not('song_title', 'is', null)
          .limit(200)

        // PARALLEL SEARCH 3: Alias/translation match (if table exists)
        const aliasMatchPromise = (async (): Promise<SongImageRecord[]> => {
          try {
            const res = await supabase
              .from('song_aliases')
              .select('song_title')
              .ilike('alias', `%${cleanSearchTerms}%`)
              .limit(10)

            if (res.data && res.data.length > 0) {
              const titles = res.data.map((a: { song_title: string }) => a.song_title)
              const { data } = await supabase
                .from('song_images')
                .select('*')
                .in('song_title', titles)
                .limit(15)
              return (data || []) as SongImageRecord[]
            }
            return []
          } catch {
            return [] // Table might not exist yet
          }
        })()

        // Run searches in parallel
        const [exactResult, allSongsResult, aliasResult] = await Promise.all([
          exactMatchPromise,
          normalizedMatchPromise,
          aliasMatchPromise,
        ])

        // Process exact matches (score: 1.0)
        if (exactResult.data && exactResult.data.length > 0) {
          addScoredResults(exactResult.data as SongImageRecord[], 1.0, 'exact')
          console.log(`[Exact Match] Found ${exactResult.data.length} exact title matches`)
        }

        // Process normalized matches (score: 0.95)
        if (allSongsResult.data && allSongsResult.data.length > 0) {
          const allSongs = allSongsResult.data as SongImageRecord[]

          // Exact normalized matches
          const normalizedMatches = allSongs.filter((r: SongImageRecord) => {
            if (!r.song_title) return false
            const titleNorm = normalizeKorean(r.song_title)
            return titleNorm.includes(normalizedQuery) || normalizedQuery.includes(titleNorm)
          })
          if (normalizedMatches.length > 0) {
            addScoredResults(normalizedMatches, 0.95, 'normalized')
            console.log(`[Normalized Match] Found ${normalizedMatches.length} normalized matches`)
          }

          // Fuzzy title matches (similarity × 0.8) - handles typos
          const fuzzyTitleMatches = allSongs
            .filter(r => r.song_title && !normalizedMatches.includes(r))  // Exclude already matched
            .map(r => ({
              ...r,
              fuzzyScore: calculateSimilarity(r.song_title || '', cleanSearchTerms)
            }))
            .filter(r => r.fuzzyScore > 0.3)  // Threshold for fuzzy matching
            .sort((a, b) => b.fuzzyScore - a.fuzzyScore)
            .slice(0, 10)

          if (fuzzyTitleMatches.length > 0) {
            for (const r of fuzzyTitleMatches) {
              addScoredResults([r], r.fuzzyScore * 0.8, 'fuzzy', r.song_title)
            }
            console.log(`[Fuzzy Match] Found ${fuzzyTitleMatches.length} fuzzy title matches`)
          }
        }

        // Process alias matches (score: 0.95)
        if (aliasResult && aliasResult.length > 0) {
          addScoredResults(aliasResult as SongImageRecord[], 0.95, 'alias')
          console.log(`[Alias Match] Found ${aliasResult.length} alias matches`)
        }

        // PARALLEL SEARCH 4: Vector search (only if no high-confidence matches)
        if (scoredResults.length === 0 && VOYAGE_API_KEY) {
          try {
            const queryEmbedding = await generateEmbedding(message)
            const { data, error } = await supabase.rpc('search_songs_by_embedding', {
              query_embedding: queryEmbedding,
              match_threshold: SIMILARITY_THRESHOLD_LOW, // Use lower threshold
              match_count: 15,
            })

            if (!error && data && data.length > 0) {
              // For vector search, use the similarity score directly
              // NO strict keyword filter - allow semantic matches
              const vectorResults = data.map((r: SongImageRecord & { similarity?: number }) => ({
                ...r,
                score: r.similarity || 0.7,
              }))

              // But boost results that have text overlap
              for (const r of vectorResults) {
                if (hasTextOverlap(r.ocr_text, message, r.song_title)) {
                  r.score = Math.min(r.score + 0.1, 0.89) // Boost but keep below text matches
                }
                addScoredResults([r], r.score, 'vector')
              }
              console.log(`[Vector Search] Found ${data.length} semantic matches`)
            }
          } catch (embError) {
            console.error('Vector search error:', embError)
          }
        }

        // FALLBACK: Fuzzy OCR search if still nothing
        if (scoredResults.length === 0) {
          const { data } = await supabase
            .from('song_images')
            .select('*')
            .ilike('ocr_text', `%${cleanSearchTerms}%`)
            .limit(10)

          if (data && data.length > 0) {
            addScoredResults(data as SongImageRecord[], 0.75, 'fuzzy')
            console.log(`[Fuzzy OCR] Found ${data.length} OCR matches`)
          }
        }
      }

      // Sort by score (highest first) and convert to searchResults format
      scoredResults.sort((a, b) => b.score - a.score)

      console.log(`[Scoring] Total scored results: ${scoredResults.length}`)
      scoredResults.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.song_title || r.original_filename} (score: ${r.score.toFixed(2)}, type: ${r.matchType})`)
      })

      // Convert to searchResults format
      searchResults = scoredResults.map(r => ({
        id: r.id,
        image_url: r.image_url,
        original_filename: r.original_filename,
        ocr_text: r.ocr_text,
        song_title: r.song_title,
        song_key: r.song_key,
        similarity: r.score,
        matchType: r.matchType,
        matchedOn: r.matchedOn,
      }))
    }

    // No Google fallback - will use Claude suggestions instead if no results

    // Group results by song title (combines multi-page sheets into one entry)
    const groupedResults = groupResultsBySong(searchResults, requestedKey || undefined)
    console.log(`[Grouping] ${searchResults.length} raw results -> ${groupedResults.length} grouped songs`)

    // Limit to MAX_SUGGESTIONS (could be 1-3)
    const limitedGroups = groupedResults.slice(0, MAX_SUGGESTIONS)
    console.log(`[Limiting] Showing ${limitedGroups.length} of ${groupedResults.length} songs (max: ${MAX_SUGGESTIONS})`)

    // Check if we need to ask for key selection
    // If user is searching for a specific song without specifying key, and multiple keys exist
    let needsKeySelection = false
    let availableKeyVariants: string[] = []

    if (limitedGroups.length > 0 && !requestedKey && !keyQuery.isKeyQuery && isSpecificSong) {
      // Get all available keys from the first (best match) song
      const firstSong = limitedGroups[0]
      if (firstSong.availableKeys.length > 1) {
        needsKeySelection = true
        availableKeyVariants = firstSong.availableKeys
        console.log(`[Key Selection] Song "${firstSong.title}" has multiple keys: ${availableKeyVariants.join(', ')}`)
      }
    }

    let assistantMessage: string
    let usedClaude = false

    // Determine total results
    const hasDbResults = limitedGroups.length > 0
    const totalResults = limitedGroups.length

    // COST OPTIMIZATION: Only use Claude when necessary
    if (totalResults > 0 && !needsHelp) {
      if (needsKeySelection) {
        // Ask user to select a key
        const keyList = availableKeyVariants.join(', ')
        const songTitle = limitedGroups[0].title
        assistantMessage = isKorean
          ? `'${songTitle}' 악보를 찾았습니다!\n🎹 사용 가능한 키: ${keyList}\n\n어떤 키로 보시겠어요? 원하시는 키를 선택하거나 입력해주세요.`
          : `Found '${songTitle}'!\n🎹 Available keys: ${keyList}\n\nWhich key would you like? Please select or type your preferred key.`
      } else {
        // Normal response - use flat results for smart response
        const flatResults = limitedGroups.flatMap(g => g.pages)
        assistantMessage = generateSmartResponse({
          results: flatResults,
          searchQuery: message,
          isKorean,
          isKeyListQuery: keyQuery.isKeyQuery,
          requestedKey: keyQuery.requestedKey || requestedKey || undefined,
          availableKeyVariants,
          needsKeySelection: false,
        })
      }
    } else {
      // Use Claude for help (when no results or user needs assistance)
      usedClaude = true

      const songTitles = limitedGroups
        .map(g => g.title)
        .slice(0, 3)
        .join(', ')

      // Build conversation context from history
      const historyContext = conversationHistory.length > 0
        ? `\nRecent conversation:\n${conversationHistory.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}\n`
        : ''

      const prompt = totalResults > 0
        ? `You are a helpful assistant for a praise worship team. A user is looking for song chord sheets.
${historyContext}
Current message: "${message}"

I found ${totalResults} matching song(s): ${songTitles}

The user seems to need help (maybe wrong results or a question). Use the conversation history for context if relevant. Generate a brief, helpful response. Respond in ${isKorean ? 'Korean' : 'English'}.`
        : `You are a helpful assistant for a praise worship team. A user is looking for song chord sheets.
${historyContext}
Current message: "${message}"

No matching songs were found in the database or web search. Use the conversation history for context if relevant. Generate a brief, friendly response suggesting alternative search terms or asking for clarification. Respond in ${isKorean ? 'Korean' : 'English'}.`

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        })

        const textContent = response.content.find(c => c.type === 'text')
        assistantMessage = textContent && textContent.type === 'text'
          ? textContent.text
          : (isKorean
              ? '죄송합니다. 검색 결과가 없습니다. 다른 키워드로 시도해 주세요.'
              : 'Sorry, no results found. Please try different keywords.')
      } catch (claudeError) {
        console.error('Claude error:', claudeError)
        assistantMessage = isKorean
          ? '검색 결과가 없습니다. 다른 키워드로 시도해 주세요.'
          : 'No results found. Please try different keywords.'
        usedClaude = false
      }
    }

    // Build final images array from grouped results
    const allResultIds = new Set(limitedGroups.flatMap(g => g.pages.map(p => p.id)))

    const dbImagesWithRelated = await Promise.all(
      limitedGroups.map(async (group) => {
        // First page is the main result
        const mainPage = group.pages[0]

        // Find any additional related pages not in the group
        const additionalRelated = await findRelatedPages(supabase, mainPage, allResultIds)

        // Combine group pages (excluding main) with additional related pages
        const groupRelatedPages = group.pages.slice(1)

        // Deduplicate: only add additional related pages that aren't already in the group
        const groupPageIds = new Set(group.pages.map(p => p.id))
        const uniqueAdditionalRelated = additionalRelated.filter(rp => !groupPageIds.has(rp.id))
        const allRelatedPages = [...groupRelatedPages, ...uniqueAdditionalRelated]

        // Add all IDs to prevent duplicates across groups
        allRelatedPages.forEach(rp => allResultIds.add(rp.id))

        return {
          id: mainPage.id,
          url: mainPage.image_url,
          filename: mainPage.original_filename,
          ocrText: mainPage.ocr_text,
          songKey: mainPage.song_key,
          isFromGoogle: false,
          availableKeys: group.availableKeys,
          score: mainPage.similarity,
          matchType: mainPage.matchType,
          matchedOn: mainPage.matchedOn,
          relatedPages: allRelatedPages.map(rp => ({
            id: rp.id,
            url: rp.image_url,
            filename: rp.original_filename,
            ocrText: rp.ocr_text,
            songKey: rp.song_key,
          })),
          totalPages: 1 + allRelatedPages.length,
        }
      })
    )

    // Use database results only (Google search was removed - poor quality)
    const allImages = dbImagesWithRelated

    // Debug: Log what we're sending
    console.log('[API Response] Sending images:')
    allImages.forEach((img, i) => {
      console.log(`  ${i + 1}. ${img.filename} (Key: ${img.songKey || 'N/A'})`)
      console.log(`     Available keys: ${img.availableKeys?.join(', ') || 'none'}`)
      console.log(`     Related pages: ${img.relatedPages?.length || 0}`)
    })

    return NextResponse.json({
      message: assistantMessage,
      images: allImages,
      needsKeySelection,
      availableKeys: availableKeyVariants,
      _debug: {
        usedClaude,
        rawResultCount: searchResults.length,
        groupedCount: groupedResults.length,
        shownCount: allImages.length,
        needsHelp,
      },
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
