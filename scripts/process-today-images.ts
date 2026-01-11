import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Load environment variables from .env.local
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Gemini 3 Pro Preview - Best accuracy for OCR
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3-large'

// Process from the main folder (today's images)
const SOURCE_DIR = '/Users/stevesong/Documents/rag_kakao'
const BUCKET_NAME = 'song-sheets'

interface ExtractedInfo {
  title: string
  title_korean?: string
  title_english?: string
  key?: string
  ocr_text: string
  page_number?: number
  total_pages?: number
}

interface ImageGroup {
  timestamp: string
  files: { path: string; pageNum: number; filename: string }[]
}

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[] }>
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

async function extractSongInfoFromImage(imageBase64: string, mimeType: string, isFirstPage: boolean): Promise<ExtractedInfo> {
  const prompt = isFirstPage
    ? `This is a chord/lyric sheet for a worship song. Please extract the following information in JSON format:
{
  "title": "The main title of the song (could be Korean or English)",
  "title_korean": "Korean title if present (null if not)",
  "title_english": "English title if present (null if not)",
  "key": "Musical key if shown (e.g., G, A, C, Am, Dm, Bb, F#, etc.) - LOOK CAREFULLY for this",
  "ocr_text": "All readable text from the image including lyrics and chords (for search indexing)",
  "page_number": "Page number if shown (1 if not specified)",
  "total_pages": "Total pages if shown (null if not)"
}

IMPORTANT for key extraction:
- Look for patterns like "Key: G", "키: G", "G key", "G 키", or just a standalone letter near the title
- Check top corners, headers, or anywhere near the title
- Common key formats: G, A, C, D, E, F, B, Am, Dm, Em, Gm, Bb, Eb, F#, C#m, etc.
- If you see chord progressions (like G-C-D) but no explicit key, identify the key from the first/last chord
- If no key is found after careful inspection, return null

Return ONLY valid JSON, no markdown or other text.`
    : `This appears to be a continuation page of a chord/lyric sheet. Please extract:
{
  "title": "The song title if visible, or null",
  "ocr_text": "All readable text from the image including lyrics and chords",
  "page_number": "Page number if shown"
}

Return ONLY valid JSON, no markdown or other text.`

  const maxRetries = 3
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await geminiModel.generateContent([
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType
          }
        },
        prompt
      ])

      const text = result.response.text()
      let jsonStr = text.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      }

      return JSON.parse(jsonStr)
    } catch (error: unknown) {
      const err = error as { status?: number }
      if (err.status === 429 && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 2000
        console.log(`     Rate limited, waiting ${waitTime/1000}s before retry...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }
      console.error('Error extracting info with Gemini:', error)
      return { title: 'Unknown', ocr_text: '' }
    }
  }
  return { title: 'Unknown', ocr_text: '' }
}

async function checkForDuplicate(title: string, key?: string): Promise<{ isDuplicate: boolean; existingId?: string }> {
  if (!title || title === 'Unknown') {
    return { isDuplicate: false }
  }

  // Check by exact title AND key match - allow same song with different keys
  const { data: byTitle } = await supabase
    .from('song_images')
    .select('id, song_title, song_key')
    .or(`song_title.ilike.%${title}%,song_title_korean.ilike.%${title}%,song_title_english.ilike.%${title}%`)
    .limit(10)

  if (byTitle && byTitle.length > 0) {
    // Check if there's already a version with the same key
    const sameKeyMatch = byTitle.find(song =>
      song.song_key?.toLowerCase() === key?.toLowerCase()
    )
    if (sameKeyMatch) {
      console.log(`     Found duplicate with same key: "${sameKeyMatch.song_title}" (${sameKeyMatch.song_key})`)
      return { isDuplicate: true, existingId: sameKeyMatch.id }
    }
    // Different key = not a duplicate
    console.log(`     Found "${byTitle[0].song_title}" but different key (existing: ${byTitle[0].song_key}, new: ${key}) - WILL SAVE`)
  }

  return { isDuplicate: false }
}

async function uploadImageToSupabase(filePath: string, fileName: string): Promise<string | null> {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileBuffer, {
        contentType: filePath.endsWith('.png') ? 'image/png' : 'image/jpeg',
        upsert: true,
      })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName)
    return urlData.publicUrl
  } catch (error) {
    console.error('Error uploading:', error)
    return null
  }
}

function groupImagesByTimestamp(files: string[]): ImageGroup[] {
  // First, sort all files by filename to understand the sequence
  const sortedFiles = [...files].sort()

  // Analyze the patterns - look for consecutive page numbers
  // Pattern: KakaoTalk_Photo_2026-01-10-19-22-39 001.jpeg
  //          KakaoTalk_Photo_2026-01-10-19-22-41 002.jpeg
  //          KakaoTalk_Photo_2026-01-10-19-22-42 003.jpeg
  // These are likely one multi-page song (pages 001, 002, 003)

  // Then a new sequence starts:
  //          KakaoTalk_Photo_2026-01-10-19-22-57 001.jpeg <- starts with 001 again = new song!
  //          KakaoTalk_Photo_2026-01-10-19-22-59 002.jpeg

  const groups: ImageGroup[] = []
  let currentGroup: ImageGroup | null = null

  for (const file of sortedFiles) {
    const match = file.match(/KakaoTalk_Photo_(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\s+(\d{3})\.jpeg/i)
    if (match) {
      const fullTimestamp = match[1] // e.g., "2026-01-10-19-22-39"
      const pageNum = parseInt(match[2], 10) // e.g., 1, 2, 3

      // Start new group if: this is page 001 OR first file
      if (pageNum === 1 || !currentGroup) {
        if (currentGroup) {
          groups.push(currentGroup)
        }
        currentGroup = { timestamp: fullTimestamp, files: [] }
      }

      currentGroup.files.push({
        path: path.join(SOURCE_DIR, file),
        pageNum,
        filename: file
      })
    }
  }

  // Don't forget the last group
  if (currentGroup && currentGroup.files.length > 0) {
    groups.push(currentGroup)
  }

  // Sort files within each group by page number
  for (const group of groups) {
    group.files.sort((a, b) => a.pageNum - b.pageNum)
  }

  return groups
}

async function processImageGroups() {
  console.log('========================================')
  console.log('Processing TODAY\'s images with multi-page support')
  console.log('Source:', SOURCE_DIR)
  console.log('========================================\n')

  if (!VOYAGE_API_KEY) {
    console.error('ERROR: VOYAGE_API_KEY is not set')
    process.exit(1)
  }

  // Find only today's images (Jan 10, 2026)
  const allFiles = fs.readdirSync(SOURCE_DIR).filter(f => {
    const lower = f.toLowerCase()
    return (lower.endsWith('.jpeg') || lower.endsWith('.jpg') || lower.endsWith('.png')) &&
           f.includes('2026-01-10')
  })

  console.log(`Found ${allFiles.length} images from today\n`)

  // Group by timestamp pattern to detect multi-page sheets
  const imageGroups = groupImagesByTimestamp(allFiles)
  console.log(`Detected ${imageGroups.length} song groups:\n`)

  for (const group of imageGroups) {
    console.log(`  - ${group.timestamp}: ${group.files.length} page(s)`)
    for (const f of group.files) {
      console.log(`      Page ${f.pageNum}: ${f.filename}`)
    }
  }
  console.log('')

  let processed = 0
  let skippedDuplicates = 0
  let errors = 0

  for (let groupIdx = 0; groupIdx < imageGroups.length; groupIdx++) {
    const group = imageGroups[groupIdx]
    const isMultiPage = group.files.length > 1

    console.log(`\n${'='.repeat(50)}`)
    console.log(`[Group ${groupIdx + 1}/${imageGroups.length}] ${isMultiPage ? `Multi-page (${group.files.length} pages)` : 'Single page'}`)
    console.log(`${'='.repeat(50)}`)

    // Process first page to get main metadata
    const firstFile = group.files[0]
    console.log(`\n  Processing first page: ${firstFile.filename}`)

    // Read image as base64
    const imageBuffer = fs.readFileSync(firstFile.path)
    const imageBase64 = imageBuffer.toString('base64')
    const mimeType = 'image/jpeg'

    // Extract song info from first page
    console.log('    1. Extracting with Gemini 3 Pro Preview...')
    const mainInfo = await extractSongInfoFromImage(imageBase64, mimeType, true)
    console.log(`       Title: ${mainInfo.title}`)
    console.log(`       Korean: ${mainInfo.title_korean || 'N/A'}`)
    console.log(`       English: ${mainInfo.title_english || 'N/A'}`)
    console.log(`       Key: ${mainInfo.key || 'Unknown'}`)

    // Check for duplicates
    console.log('    2. Checking for duplicates...')
    const { isDuplicate } = await checkForDuplicate(mainInfo.title, mainInfo.key)

    if (isDuplicate) {
      console.log(`    SKIPPING entire group - Duplicate found with same key`)
      skippedDuplicates += group.files.length
      continue
    }
    console.log('       No duplicate found, proceeding...')

    // Process all pages in the group
    for (let pageIdx = 0; pageIdx < group.files.length; pageIdx++) {
      const file = group.files[pageIdx]
      const isFirst = pageIdx === 0
      const pageNumber = pageIdx + 1

      console.log(`\n  [Page ${pageNumber}/${group.files.length}] ${file.filename}`)

      try {
        let info: ExtractedInfo
        let pageImageBase64: string
        let pageMimeType: string = 'image/jpeg'

        if (isFirst) {
          // Already have the info
          info = mainInfo
          pageImageBase64 = imageBase64
        } else {
          // Read and process subsequent pages
          const pageBuffer = fs.readFileSync(file.path)
          pageImageBase64 = pageBuffer.toString('base64')

          console.log('    Extracting OCR text...')
          info = await extractSongInfoFromImage(pageImageBase64, pageMimeType, false)
          // Use main info for title/key
          info.title = mainInfo.title
          info.title_korean = mainInfo.title_korean
          info.title_english = mainInfo.title_english
          info.key = mainInfo.key
        }

        // Create text for embedding
        const textForEmbedding = [
          info.title,
          info.title_korean,
          info.title_english,
          info.key,
          info.ocr_text,
        ].filter(Boolean).join(' ').trim()

        // Generate embedding
        console.log('    Generating embedding...')
        let embedding: number[] | null = null
        try {
          embedding = await generateEmbedding(textForEmbedding)
          console.log(`       Embedding: ${embedding.length} dimensions`)
        } catch (embError) {
          console.error('       Embedding error:', embError)
        }

        // Upload to storage
        console.log('    Uploading to Supabase Storage...')
        const cleanFileName = `new_${Date.now()}_${file.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const imageUrl = await uploadImageToSupabase(file.path, cleanFileName)

        if (!imageUrl) {
          console.log('       Failed to upload, skipping...')
          errors++
          continue
        }

        // Save to database (multi-page sheets linked via filename pattern: Title_001, Title_002, etc.)
        // Rename file to include song title for proper grouping
        const pageStr = String(pageNumber).padStart(3, '0')
        const safeTitle = (info.title || 'Unknown').replace(/[^a-zA-Z0-9가-힣]/g, '_').substring(0, 50)
        const storageName = `${safeTitle}_${info.key || 'Unknown'}_${pageStr}_${Date.now()}.jpeg`

        console.log('    Saving to database...')
        const { error } = await supabase.from('song_images').insert({
          image_url: imageUrl,
          original_filename: storageName,  // Use meaningful name for multi-page grouping
          ocr_text: textForEmbedding,
          embedding_multilingual: embedding,
          song_key: info.key || 'Unknown',
          song_title: info.title || null,
          song_title_korean: info.title_korean || null,
          song_title_english: info.title_english || null,
        })

        if (error) {
          console.error('       Database error:', error)
          errors++
        } else {
          console.log(`       ✓ Successfully inserted! ${isMultiPage ? `(Page ${pageNumber}/${group.files.length}, File: ${storageName})` : ''}`)
          processed++
        }

        // Rate limiting between pages
        if (pageIdx < group.files.length - 1) {
          console.log('    Waiting 3s...')
          await new Promise(resolve => setTimeout(resolve, 3000))
        }

      } catch (error) {
        console.error(`    Error processing ${file.filename}:`, error)
        errors++
      }
    }

    // Rate limiting between groups
    if (groupIdx < imageGroups.length - 1) {
      console.log('\n  Waiting 5s before next group...')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  console.log('\n========================================')
  console.log('Processing complete!')
  console.log(`  Processed: ${processed} pages`)
  console.log(`  Skipped (duplicates): ${skippedDuplicates}`)
  console.log(`  Errors: ${errors}`)
  console.log('========================================')
}

processImageGroups().catch(console.error)
