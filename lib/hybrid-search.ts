/**
 * Hybrid Search Implementation with Reciprocal Rank Fusion (RRF)
 *
 * This module implements RAG best practices:
 * 1. Parallel execution of multiple search methods
 * 2. RRF for combining results (not fixed scores)
 * 3. Two-stage retrieval pattern (retrieve many → rerank to few)
 *
 * Research shows hybrid search improves accuracy by 25-40% over single-method search.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface SearchResult {
  id: string
  song_title: string | null
  song_title_korean: string | null
  song_title_english: string | null
  song_key: string | null
  image_url: string
  ocr_text: string | null
  original_filename: string | null
  song_group_id: string | null
  page_number: number | null
}

export interface RankedResult extends SearchResult {
  rrf_score: number
  matched_methods: string[]
}

/**
 * Reciprocal Rank Fusion (RRF) algorithm
 * Combines results from multiple search methods by rank position, not raw scores
 *
 * Formula: RRF(d) = Σ 1/(k + rank(d)) for each search method
 * where k is a constant (typically 60) that dampens the effect of high rankings
 *
 * Why RRF works better than fixed scores:
 * - Different search methods produce incomparable scores (0.8 fuzzy ≠ 0.8 vector)
 * - RRF normalizes by using rank positions which are always comparable
 * - Documents found by multiple methods get boosted naturally
 */
export function reciprocalRankFusion(
  searchResults: Map<string, SearchResult[]>,
  k: number = 60
): RankedResult[] {
  const scoreMap = new Map<string, { score: number; result: SearchResult; methods: string[] }>()

  for (const [method, results] of searchResults) {
    results.forEach((result, index) => {
      const rank = index + 1 // 1-indexed rank
      const rrfScore = 1 / (k + rank)

      const existing = scoreMap.get(result.id)
      if (existing) {
        existing.score += rrfScore
        existing.methods.push(method)
      } else {
        scoreMap.set(result.id, {
          score: rrfScore,
          result,
          methods: [method]
        })
      }
    })
  }

  return Array.from(scoreMap.values())
    .map(({ score, result, methods }) => ({
      ...result,
      rrf_score: score,
      matched_methods: methods
    }))
    .sort((a, b) => b.rrf_score - a.rrf_score)
}

/**
 * Normalize Korean text for matching
 * - NFC normalization for consistent Unicode
 * - Remove all whitespace
 * - Lowercase for case-insensitive matching
 */
export function normalizeKorean(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFC')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns value between 0 (completely different) and 1 (identical)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeKorean(str1)
  const s2 = normalizeKorean(str2)

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  // Check if one contains the other (partial match)
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = Math.min(s1.length, s2.length)
    const longer = Math.max(s1.length, s2.length)
    return shorter / longer
  }

  // Levenshtein distance calculation
  const matrix: number[][] = []

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  const maxLen = Math.max(s1.length, s2.length)
  return 1 - matrix[s1.length][s2.length] / maxLen
}

/**
 * Search Methods - All run in parallel for hybrid search
 */

// 1. Exact title match using ILIKE
export async function searchExact(
  supabase: SupabaseClient,
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from('song_images')
    .select('id, song_title, song_title_korean, song_title_english, song_key, image_url, ocr_text, original_filename, song_group_id, page_number')
    .or(`song_title.ilike.%${query}%,song_title_korean.ilike.%${query}%,song_title_english.ilike.%${query}%`)
    .limit(limit)

  if (error) {
    console.error('[Exact Search] Error:', error.message)
    return []
  }

  return (data || []) as SearchResult[]
}

// 2. BM25 Full-Text Search (requires add-fts-search.sql migration)
export async function searchBM25(
  supabase: SupabaseClient,
  query: string,
  limit: number = 20
): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .rpc('search_bm25', { query_text: query, match_count: limit })

  if (error) {
    // Table might not have FTS enabled yet - graceful fallback
    console.warn('[BM25 Search] Not available:', error.message)
    return []
  }

  return (data || []) as SearchResult[]
}

// 3. Alias lookup (cross-language: English ↔ Korean)
export async function searchAliases(
  supabase: SupabaseClient,
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    // First find matching aliases
    const { data: aliases, error: aliasError } = await supabase
      .from('song_aliases')
      .select('song_title')
      .ilike('alias', `%${query}%`)
      .limit(limit)

    if (aliasError || !aliases?.length) return []

    // Then get the songs
    const songTitles = aliases.map(a => a.song_title)
    const { data: songs, error: songError } = await supabase
      .from('song_images')
      .select('id, song_title, song_title_korean, song_title_english, song_key, image_url, ocr_text, original_filename, song_group_id, page_number')
      .in('song_title', songTitles)
      .limit(limit)

    if (songError) return []

    return (songs || []) as SearchResult[]
  } catch {
    // Table might not exist yet
    return []
  }
}

// 4. Normalized Korean matching (handles spacing variations)
export async function searchNormalized(
  supabase: SupabaseClient,
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  // Get songs with titles for client-side normalization
  const { data, error } = await supabase
    .from('song_images')
    .select('id, song_title, song_title_korean, song_title_english, song_key, image_url, ocr_text, original_filename, song_group_id, page_number')
    .not('song_title', 'is', null)
    .limit(200)

  if (error || !data) return []

  const normalizedQuery = normalizeKorean(query)

  return data
    .filter(song => {
      const titleNorm = normalizeKorean(song.song_title || '')
      const koreanNorm = normalizeKorean(song.song_title_korean || '')
      const englishNorm = normalizeKorean(song.song_title_english || '')

      return titleNorm.includes(normalizedQuery) ||
             koreanNorm.includes(normalizedQuery) ||
             englishNorm.includes(normalizedQuery) ||
             normalizedQuery.includes(titleNorm) ||
             normalizedQuery.includes(koreanNorm)
    })
    .slice(0, limit) as SearchResult[]
}

// 5. Fuzzy matching with Levenshtein similarity (handles typos)
export async function searchFuzzy(
  supabase: SupabaseClient,
  query: string,
  threshold: number = 0.6,
  limit: number = 10
): Promise<SearchResult[]> {
  // Get all songs and filter by similarity
  const { data, error } = await supabase
    .from('song_images')
    .select('id, song_title, song_title_korean, song_title_english, song_key, image_url, ocr_text, original_filename, song_group_id, page_number')
    .not('song_title', 'is', null)
    .limit(500)

  if (error || !data) return []

  return data
    .map(song => {
      const titleSim = song.song_title ? calculateSimilarity(song.song_title, query) : 0
      const koreanSim = song.song_title_korean ? calculateSimilarity(song.song_title_korean, query) : 0
      const englishSim = song.song_title_english ? calculateSimilarity(song.song_title_english, query) : 0
      const maxSim = Math.max(titleSim, koreanSim, englishSim)
      return { ...song, similarity: maxSim }
    })
    .filter(song => song.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit) as SearchResult[]
}

// 6. Vector similarity search (semantic matching)
export async function searchVector(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  threshold: number = 0.5,
  limit: number = 20
): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .rpc('search_songs_by_embedding', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit
    })

  if (error) {
    console.error('[Vector Search] Error:', error.message)
    return []
  }

  return (data || []) as SearchResult[]
}

// 7. OCR text search (fallback for lyrics/content search)
export async function searchOCR(
  supabase: SupabaseClient,
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from('song_images')
    .select('id, song_title, song_title_korean, song_title_english, song_key, image_url, ocr_text, original_filename, song_group_id, page_number')
    .ilike('ocr_text', `%${query}%`)
    .limit(limit)

  if (error) return []

  return (data || []) as SearchResult[]
}

/**
 * Main Hybrid Search Function
 *
 * Executes all search methods in PARALLEL and combines results using RRF.
 * This is the core improvement over the previous cascade approach.
 *
 * Benefits:
 * - Vector search always runs (catches semantic matches)
 * - BM25 provides proper keyword relevance ranking
 * - RRF combines all results fairly by rank position
 * - Results found by multiple methods get boosted
 */
export async function hybridSearch(
  supabase: SupabaseClient,
  query: string,
  queryEmbedding: number[],
  options: {
    exactLimit?: number
    bm25Limit?: number
    normalizedLimit?: number
    aliasLimit?: number
    fuzzyLimit?: number
    vectorLimit?: number
    ocrLimit?: number
    fuzzyThreshold?: number
    vectorThreshold?: number
  } = {}
): Promise<RankedResult[]> {
  const {
    exactLimit = 10,
    bm25Limit = 20,
    normalizedLimit = 10,
    aliasLimit = 10,
    fuzzyLimit = 10,
    vectorLimit = 20,
    ocrLimit = 10,
    fuzzyThreshold = 0.6,
    vectorThreshold = 0.5
  } = options

  console.log(`[Hybrid Search] Query: "${query}"`)

  // Execute ALL search methods in parallel
  const startTime = Date.now()
  const [exactResults, bm25Results, normalizedResults, aliasResults, fuzzyResults, vectorResults, ocrResults] =
    await Promise.all([
      searchExact(supabase, query, exactLimit),
      searchBM25(supabase, query, bm25Limit),
      searchNormalized(supabase, query, normalizedLimit),
      searchAliases(supabase, query, aliasLimit),
      searchFuzzy(supabase, query, fuzzyThreshold, fuzzyLimit),
      searchVector(supabase, queryEmbedding, vectorThreshold, vectorLimit),
      searchOCR(supabase, query, ocrLimit)
    ])
  const elapsed = Date.now() - startTime

  console.log(`[Hybrid Search] Completed in ${elapsed}ms:`)
  console.log(`  - Exact: ${exactResults.length}`)
  console.log(`  - BM25: ${bm25Results.length}`)
  console.log(`  - Normalized: ${normalizedResults.length}`)
  console.log(`  - Alias: ${aliasResults.length}`)
  console.log(`  - Fuzzy: ${fuzzyResults.length}`)
  console.log(`  - Vector: ${vectorResults.length}`)
  console.log(`  - OCR: ${ocrResults.length}`)

  // Combine all results using Reciprocal Rank Fusion
  const searchResultsMap = new Map<string, SearchResult[]>([
    ['exact', exactResults],
    ['bm25', bm25Results],
    ['normalized', normalizedResults],
    ['alias', aliasResults],
    ['fuzzy', fuzzyResults],
    ['vector', vectorResults],
    ['ocr', ocrResults]
  ])

  const fusedResults = reciprocalRankFusion(searchResultsMap)
  console.log(`[Hybrid Search] RRF combined: ${fusedResults.length} unique results`)

  return fusedResults
}
