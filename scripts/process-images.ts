import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// Load environment variables from .env.local
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3-lite'

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
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `This is a chord/lyric sheet for a worship song. Please extract the following information in JSON format:
{
  "title": "The main title of the song (could be Korean or English)",
  "title_korean": "Korean title if present (null if not)",
  "title_english": "English title if present (null if not)",
  "key": "Musical key if shown (e.g., G, A, C, etc.)",
  "ocr_text": "All readable text from the image including lyrics and chords (for search indexing)"
}

Return ONLY valid JSON, no markdown or other text.`,
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Clean the response - remove markdown code blocks if present
    let jsonStr = textContent.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('Error extracting info:', error)
    return {
      title: 'Unknown',
      ocr_text: '',
    }
  }
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

  // Get all image files
  const files = fs.readdirSync(SOURCE_DIR).filter(f =>
    f.endsWith('.jpeg') || f.endsWith('.jpg') || f.endsWith('.png') ||
    f.endsWith('.jpeg.jpeg') || f.endsWith('.png.png')
  )

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

      if (existing && existing.length > 0) {
        console.log('     Already processed (by filename), skipping...')
        continue
      }

      // Check for duplicate content using MD5 hash
      const contentHash = computeFileHash(filePath)
      if (processedHashes.has(contentHash)) {
        console.log('     Duplicate content (same as earlier file in batch), skipping...')
        continue
      }

      // Note: Skipping DB hash check since content_hash column may not exist
      // Just track hashes locally within this batch for now
      processedHashes.add(contentHash)
      // Read image as base64
      const imageBuffer = fs.readFileSync(filePath)
      const imageBase64 = imageBuffer.toString('base64')
      const mimeType = fileName.includes('.png') ? 'image/png' : 'image/jpeg'

      // Extract song info using Claude Vision
      console.log('  1. Extracting song info with Claude Vision...')
      const info = await extractSongInfoFromImage(imageBase64, mimeType)
      console.log(`     Title: ${info.title}`)

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

      // Insert into database with embedding
      console.log('  4. Saving to database...')
      const insertData: Record<string, unknown> = {
        image_url: imageUrl,
        original_filename: fileName,
        ocr_text: textForEmbedding,
        embedding: embedding,
      }
      // Only add song_key if extracted (column may not exist in all setups)
      // if (info.key) insertData.song_key = info.key

      const { error } = await supabase.from('song_images').insert(insertData)

      if (error) {
        console.error('     Database error:', error)
      } else {
        console.log('     Done!')
      }

      // Rate limiting - wait 25 seconds between images to stay under Voyage AI free tier limit (3 RPM)
      console.log('     Waiting 25s for rate limit...')
      await new Promise(resolve => setTimeout(resolve, 25000))

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
