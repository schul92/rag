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
const VOYAGE_MODEL = 'voyage-multilingual-2'

// Process from the NEW folder
const SOURCE_DIR = '/Users/stevesong/Documents/rag_kakao/new'
const BUCKET_NAME = 'song-sheets'

// Track content hashes to detect duplicates within this batch
const processedHashes = new Set<string>()

function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('md5').update(content).digest('hex')
}

interface ExtractedInfo {
  title: string
  title_korean?: string
  title_english?: string
  key?: string
  ocr_text: string
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

async function extractSongInfoFromImage(imageBase64: string, mimeType: string): Promise<ExtractedInfo> {
  const prompt = `This is a chord/lyric sheet for a worship song. Please extract the following information in JSON format:
{
  "title": "The main title of the song (could be Korean or English)",
  "title_korean": "Korean title if present (null if not)",
  "title_english": "English title if present (null if not)",
  "key": "Musical key if shown (e.g., G, A, C, Am, Dm, Bb, F#, etc.) - LOOK CAREFULLY for this",
  "ocr_text": "All readable text from the image including lyrics and chords (for search indexing)"
}

IMPORTANT for key extraction:
- Look for patterns like "Key: G", "키: G", "G key", "G 키", or just a standalone letter near the title
- Check top corners, headers, or anywhere near the title
- Common key formats: G, A, C, D, E, F, B, Am, Dm, Em, Gm, Bb, Eb, F#, C#m, etc.
- If you see chord progressions (like G-C-D) but no explicit key, identify the key from the first/last chord
- Look at the key signature (sharps/flats at the start of the staff) to determine the key
- If no key is found after careful inspection, return null

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

      // Clean the response - remove markdown code blocks if present
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
      return {
        title: 'Unknown',
        ocr_text: '',
      }
    }
  }
  return { title: 'Unknown', ocr_text: '' }
}

async function checkForDuplicate(title: string, ocrText: string, key?: string): Promise<{ isDuplicate: boolean; existingId?: string }> {
  // Check by exact title AND key match - allow same song with different keys
  if (title && title !== 'Unknown') {
    const { data: byTitle } = await supabase
      .from('song_images')
      .select('id, song_title, song_key')
      .or(`song_title.ilike.%${title}%,song_title_korean.ilike.%${title}%`)
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
      console.log(`     Found "${byTitle[0].song_title}" but different key (existing: ${byTitle[0].song_key}, new: ${key})`)
    }
  }

  // Check by OCR text similarity (first 100 chars)
  if (ocrText && ocrText.length > 50) {
    const searchText = ocrText.substring(0, 100).replace(/[%_]/g, '')
    const { data: byOcr } = await supabase
      .from('song_images')
      .select('id, song_title, song_key')
      .ilike('ocr_text', `%${searchText.substring(0, 50)}%`)
      .limit(3)

    if (byOcr && byOcr.length > 0) {
      // Check if same key
      const sameKeyMatch = byOcr.find(song =>
        song.song_key?.toLowerCase() === key?.toLowerCase()
      )
      if (sameKeyMatch) {
        console.log(`     Found duplicate by OCR: "${sameKeyMatch.song_title}" (${sameKeyMatch.song_key})`)
        return { isDuplicate: true, existingId: sameKeyMatch.id }
      }
    }
  }

  return { isDuplicate: false }
}

async function uploadImageToSupabase(filePath: string, fileName: string): Promise<string | null> {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    const { data, error } = await supabase.storage
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

async function processImages() {
  console.log('========================================')
  console.log('Processing NEW images from:', SOURCE_DIR)
  console.log('Using: Gemini 3 Pro Preview (best accuracy)')
  console.log('========================================')

  if (!VOYAGE_API_KEY) {
    console.error('ERROR: VOYAGE_API_KEY is not set in .env.local')
    process.exit(1)
  }

  const files = fs.readdirSync(SOURCE_DIR).filter(f => {
    const lower = f.toLowerCase()
    return lower.endsWith('.jpeg') || lower.endsWith('.jpg') ||
           lower.endsWith('.png') || lower.endsWith('.webp') ||
           lower.endsWith('.gif')
  })

  console.log(`Found ${files.length} image files\n`)

  let processed = 0
  let skippedDuplicates = 0
  let errors = 0

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i]
    const filePath = path.join(SOURCE_DIR, fileName)

    console.log(`\n[${i + 1}/${files.length}] Processing: ${fileName}`)

    try {
      // Check for duplicate content using MD5 hash (within this batch)
      const contentHash = computeFileHash(filePath)
      if (processedHashes.has(contentHash)) {
        console.log('     Duplicate content (same file in batch), skipping...')
        skippedDuplicates++
        continue
      }
      processedHashes.add(contentHash)

      // Read image as base64
      const imageBuffer = fs.readFileSync(filePath)
      const imageBase64 = imageBuffer.toString('base64')
      const lowerName = fileName.toLowerCase()
      let mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
      if (lowerName.includes('.png')) mimeType = 'image/png'
      else if (lowerName.includes('.gif')) mimeType = 'image/gif'
      else if (lowerName.includes('.webp')) mimeType = 'image/webp'

      // Extract song info using Gemini 3 Pro
      console.log('  1. Extracting with Gemini 3 Pro Preview...')
      const info = await extractSongInfoFromImage(imageBase64, mimeType)
      console.log(`     Title: ${info.title}`)
      console.log(`     Key: ${info.key || 'Unknown'}`)

      // Check for duplicates in DB (allows same song with different keys)
      console.log('  2. Checking for duplicates...')
      const { isDuplicate, existingId } = await checkForDuplicate(info.title, info.ocr_text, info.key)

      if (isDuplicate) {
        console.log(`     SKIPPING - Duplicate found (ID: ${existingId})`)
        skippedDuplicates++
        continue
      }
      console.log('     No duplicate found, proceeding...')

      // Create text for embedding
      const textForEmbedding = [
        info.title,
        info.title_korean,
        info.title_english,
        info.key,
        info.ocr_text,
      ].filter(Boolean).join(' ').trim()

      // Generate embedding
      console.log('  3. Generating embedding with Voyage AI...')
      let embedding: number[] | null = null
      try {
        embedding = await generateEmbedding(textForEmbedding)
        console.log(`     Embedding generated (${embedding.length} dimensions)`)
      } catch (embError) {
        console.error('     Embedding error:', embError)
      }

      // Upload to Supabase Storage
      console.log('  4. Uploading to Supabase Storage...')
      const cleanFileName = `new_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const imageUrl = await uploadImageToSupabase(filePath, cleanFileName)

      if (!imageUrl) {
        console.log('     Failed to upload, skipping...')
        errors++
        continue
      }

      // Save to database
      console.log('  5. Saving to database...')
      const { error } = await supabase.from('song_images').insert({
        image_url: imageUrl,
        original_filename: fileName,
        ocr_text: textForEmbedding,
        embedding_multilingual: embedding,  // voyage-multilingual-2 uses 1024d
        song_key: info.key || 'Unknown',
        song_title: info.title || null,
        song_title_korean: info.title_korean || null,
        song_title_english: info.title_english || null,
      })

      if (error) {
        console.error('     Database error:', error)
        errors++
      } else {
        console.log('     ✓ Successfully inserted!')
        processed++
      }

      // Rate limiting - Gemini 3 Pro has stricter limits
      console.log('     Waiting 5s...')
      await new Promise(resolve => setTimeout(resolve, 5000))

    } catch (error) {
      console.error(`  Error processing ${fileName}:`, error)
      errors++
    }
  }

  console.log('\n========================================')
  console.log('Processing complete!')
  console.log(`  Processed: ${processed}`)
  console.log(`  Skipped (duplicates): ${skippedDuplicates}`)
  console.log(`  Errors: ${errors}`)
  console.log('========================================')
}

processImages().catch(console.error)
