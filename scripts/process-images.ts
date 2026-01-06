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

// Gemini 3 Pro - Top tier Vision/OCR model (Jan 2026)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3-large'  // Best overall + multilingual, 1024d

const SOURCE_DIR = '/Users/stevesong/Documents/rag_kakao'
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
- If no key is found after careful inspection, return null

Return ONLY valid JSON, no markdown or other text.`

  // Retry with exponential backoff for rate limits
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
      // If rate limited, wait and retry
      if (err.status === 429 && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 2000 // 4s, 8s, 16s
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

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName)
    return urlData.publicUrl
  } catch (error) {
    console.error('Error uploading:', error)
    return null
  }
}

async function processImages() {
  console.log('Starting image processing with embeddings...')
  console.log('Using Voyage AI model:', VOYAGE_MODEL)

  // Check for required environment variables
  if (!VOYAGE_API_KEY) {
    console.error('ERROR: VOYAGE_API_KEY is not set in .env.local')
    console.error('Get your API key from: https://dash.voyageai.com/')
    process.exit(1)
  }

  // Get all image files (case-insensitive, including WEBP and GIF)
  const files = fs.readdirSync(SOURCE_DIR).filter(f => {
    const lower = f.toLowerCase()
    return lower.endsWith('.jpeg') || lower.endsWith('.jpg') ||
           lower.endsWith('.png') || lower.endsWith('.webp') ||
           lower.endsWith('.gif') || lower.endsWith('.jpeg.jpeg') ||
           lower.endsWith('.png.png')
  })

  console.log(`Found ${files.length} image files`)

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i]
    const filePath = path.join(SOURCE_DIR, fileName)

    console.log(`\n[${i + 1}/${files.length}] Processing: ${fileName}`)

    try {
      // Check if already processed
      const { data: existing } = await supabase
        .from('song_images')
        .select('id')
        .eq('original_filename', fileName)
        .limit(1)

      // Check for duplicate content using MD5 hash (within this batch only)
      const contentHash = computeFileHash(filePath)
      if (processedHashes.has(contentHash)) {
        console.log('     Duplicate content (same as earlier file in batch), skipping...')
        continue
      }
      processedHashes.add(contentHash)

      // Check if already processed - we'll UPDATE instead of skip
      const existingId = existing && existing.length > 0 ? existing[0].id : null
      if (existingId) {
        console.log('     Reprocessing existing record with Gemini...')
      }

      // Read image as base64
      const imageBuffer = fs.readFileSync(filePath)
      const imageBase64 = imageBuffer.toString('base64')
      const lowerName = fileName.toLowerCase()
      let mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
      if (lowerName.includes('.png')) mimeType = 'image/png'
      else if (lowerName.includes('.gif')) mimeType = 'image/gif'
      else if (lowerName.includes('.webp')) mimeType = 'image/webp'

      // Extract song info using Gemini Pro
      console.log('  1. Extracting song info with Gemini Pro...')
      const info = await extractSongInfoFromImage(imageBase64, mimeType)
      console.log(`     Title: ${info.title}`)
      console.log(`     Key: ${info.key || 'Unknown'}`)

      // Create text for embedding (combine all extracted info)
      const textForEmbedding = [
        info.title,
        info.title_korean,
        info.title_english,
        info.key,
        info.ocr_text,
      ].filter(Boolean).join(' ').trim()

      // Generate embedding using Voyage AI
      console.log('  2. Generating embedding with Voyage AI...')
      let embedding: number[] | null = null
      try {
        embedding = await generateEmbedding(textForEmbedding)
        console.log(`     Embedding generated (${embedding.length} dimensions)`)
      } catch (embError) {
        console.error('     Embedding error:', embError)
      }

      // Upload to Supabase Storage
      console.log('  3. Uploading to Supabase Storage...')
      const cleanFileName = fileName.replace('.jpeg.jpeg', '.jpeg').replace('.png.png', '.png')
      const imageUrl = await uploadImageToSupabase(filePath, cleanFileName)

      if (!imageUrl) {
        console.log('     Failed to upload, skipping...')
        continue
      }

      // Save to database (update if exists, insert if new)
      console.log('  4. Saving to database...')
      const recordData: Record<string, unknown> = {
        image_url: imageUrl,
        original_filename: fileName,
        ocr_text: textForEmbedding,
        embedding: embedding,
        // Always save key - mark as 'Unknown' if not detected
        song_key: info.key || 'Unknown',
        song_title: info.title || null,
        song_title_korean: info.title_korean || null,
        song_title_english: info.title_english || null,
      }

      let error
      if (existingId) {
        // Update existing record
        const result = await supabase.from('song_images').update(recordData).eq('id', existingId)
        error = result.error
      } else {
        // Insert new record
        const result = await supabase.from('song_images').insert(recordData)
        error = result.error
      }

      if (error) {
        console.error('     Database error:', error)
      } else {
        console.log(existingId ? '     Updated!' : '     Inserted!')
      }

      // Rate limiting - Gemini has generous limits, reduce wait time
      console.log('     Waiting 2s...')
      await new Promise(resolve => setTimeout(resolve, 3000)) // 3s delay to avoid rate limits

    } catch (error) {
      console.error(`  Error processing ${fileName}:`, error)
    }
  }

  console.log('\n========================================')
  console.log('Image processing complete!')
  console.log('========================================')
}

// Run the script
processImages().catch(console.error)
