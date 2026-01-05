import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Load environment variables from .env.local
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Gemini 3 Pro - Top tier Vision/OCR model
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-multilingual-2'  // Korean-optimized, 1024d

const BUCKET_NAME = 'song-sheets'

interface ExtractedInfo {
  title: string
  title_korean?: string
  title_english?: string
  key?: string
  artist?: string
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

async function extractSongInfoWithGemini(imageBase64: string, mimeType: string): Promise<ExtractedInfo> {
  const prompt = `This is a chord/lyric sheet for a worship song. Please extract the following information in JSON format:
{
  "title": "The main title of the song (could be Korean or English)",
  "title_korean": "Korean title if present (null if not)",
  "title_english": "English title if present (null if not)",
  "key": "Musical key if shown (e.g., G, A, C, Am, Dm, Bb, F#, etc.) - LOOK CAREFULLY for this",
  "artist": "Composer or artist name if shown (null if not)",
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

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName)
    return urlData.publicUrl
  } catch (error) {
    console.error('Error uploading:', error)
    return null
  }
}

async function processSingleImage(imagePath: string, forceUpdate: boolean = false) {
  console.log('========================================')
  console.log('Processing single image with Gemini OCR')
  console.log('========================================')
  console.log(`Image: ${imagePath}`)

  // Check for required environment variables
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('ERROR: GOOGLE_AI_API_KEY is not set in .env.local')
    process.exit(1)
  }
  if (!VOYAGE_API_KEY) {
    console.error('ERROR: VOYAGE_API_KEY is not set in .env.local')
    process.exit(1)
  }

  // Check if file exists
  if (!fs.existsSync(imagePath)) {
    console.error(`ERROR: Image file not found: ${imagePath}`)
    process.exit(1)
  }

  const fileName = path.basename(imagePath)

  // Check if already processed (unless force update)
  if (!forceUpdate) {
    const { data: existing } = await supabase
      .from('song_images')
      .select('id, song_title, song_key')
      .eq('original_filename', fileName)
      .limit(1)

    if (existing && existing.length > 0) {
      console.log(`\nSong already exists: "${existing[0].song_title}" (${existing[0].song_key})`)
      console.log('Use --force to update existing record')
      return
    }
  }

  // Read image as base64
  console.log('\n1. Reading image...')
  const imageBuffer = fs.readFileSync(imagePath)
  const imageBase64 = imageBuffer.toString('base64')
  const lowerName = fileName.toLowerCase()
  let mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
  if (lowerName.includes('.png')) mimeType = 'image/png'
  else if (lowerName.includes('.gif')) mimeType = 'image/gif'
  else if (lowerName.includes('.webp')) mimeType = 'image/webp'

  // Extract song info using Gemini Pro Vision OCR
  console.log('\n2. Extracting metadata with Gemini Pro Vision OCR...')
  const info = await extractSongInfoWithGemini(imageBase64, mimeType)
  console.log(`   Title: ${info.title}`)
  console.log(`   Title (Korean): ${info.title_korean || 'N/A'}`)
  console.log(`   Title (English): ${info.title_english || 'N/A'}`)
  console.log(`   Key: ${info.key || 'Unknown'}`)
  console.log(`   Artist: ${info.artist || 'Unknown'}`)
  console.log(`   OCR Text Length: ${info.ocr_text.length} characters`)

  // Create text for embedding
  const textForEmbedding = [
    info.title,
    info.title_korean,
    info.title_english,
    info.key,
    info.artist,
    info.ocr_text,
  ].filter(Boolean).join(' ').trim()

  // Generate embedding using Voyage AI
  console.log('\n3. Generating embedding with Voyage AI...')
  let embedding: number[] | null = null
  try {
    embedding = await generateEmbedding(textForEmbedding)
    console.log(`   Embedding generated (${embedding.length} dimensions)`)
  } catch (embError) {
    console.error('   Embedding error:', embError)
  }

  // Upload to Supabase Storage
  console.log('\n4. Uploading to Supabase Storage...')
  const imageUrl = await uploadImageToSupabase(imagePath, fileName)
  if (!imageUrl) {
    console.log('   Failed to upload image, continuing without image URL...')
  } else {
    console.log(`   Uploaded: ${imageUrl}`)
  }

  // Save to database
  console.log('\n5. Saving to database...')
  const recordData: Record<string, unknown> = {
    image_url: imageUrl,
    original_filename: fileName,
    ocr_text: textForEmbedding,
    embedding: embedding,
    song_key: info.key || 'Unknown',
    song_title: info.title || null,
    song_title_korean: info.title_korean || null,
    song_title_english: info.title_english || null,
    artist: info.artist || null,
  }

  // Check for existing record to update
  const { data: existingRecord } = await supabase
    .from('song_images')
    .select('id')
    .eq('original_filename', fileName)
    .limit(1)

  let error
  if (existingRecord && existingRecord.length > 0 && forceUpdate) {
    // Update existing record
    const result = await supabase.from('song_images').update(recordData).eq('id', existingRecord[0].id)
    error = result.error
    if (!error) console.log('   Updated existing record!')
  } else {
    // Insert new record
    const result = await supabase.from('song_images').insert(recordData)
    error = result.error
    if (!error) console.log('   Inserted new record!')
  }

  if (error) {
    console.error('   Database error:', error)
  }

  console.log('\n========================================')
  console.log('Done!')
  console.log('========================================')
}

// Parse command line arguments
const args = process.argv.slice(2)
const forceUpdate = args.includes('--force')
const imagePath = args.find(arg => !arg.startsWith('--'))

if (!imagePath) {
  console.log('Usage: tsx scripts/add-single-song.ts <image-path> [--force]')
  console.log('')
  console.log('Options:')
  console.log('  --force    Update existing record if song already exists')
  console.log('')
  console.log('Example:')
  console.log('  tsx scripts/add-single-song.ts ./source/hymn.jpg')
  console.log('  tsx scripts/add-single-song.ts ./source/hymn.png --force')
  process.exit(1)
}

// Run the script
processSingleImage(imagePath, forceUpdate).catch(console.error)
