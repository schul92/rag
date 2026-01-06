/**
 * Phase 4: Reprocess all songs with Gemini 3 Pro
 *
 * Gemini 3 Pro is the #1 Vision/OCR model (Dec 2025)
 * Better for:
 * - Korean + English mixed text
 * - Chord notation recognition
 * - Key detection
 * - Spatial understanding of sheet layouts
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
if (!GOOGLE_AI_API_KEY) {
  console.error('ERROR: GOOGLE_AI_API_KEY is not set in .env.local')
  console.error('Get your API key from: https://aistudio.google.com/app/apikey')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })

interface ExtractedInfo {
  title: string
  title_korean?: string
  title_english?: string
  key?: string
  artist?: string
  ocr_text: string
  lyrics_excerpt?: string
}

async function extractWithGemini(imageBase64: string, mimeType: string): Promise<ExtractedInfo> {
  const prompt = `This is a chord/lyric sheet for a worship song. Please extract the following information in JSON format:

{
  "title": "The main title of the song (could be Korean or English)",
  "title_korean": "Korean title if present (null if not)",
  "title_english": "English title if present (null if not)",
  "key": "Musical key if shown (e.g., G, A, C, Am, Dm, Bb, F#, etc.)",
  "artist": "Artist or composer name if visible (null if not)",
  "ocr_text": "All readable text from the image including lyrics and chords",
  "lyrics_excerpt": "First 2-3 lines of the actual lyrics (not chords)"
}

IMPORTANT for key extraction:
- Look carefully at top corners, headers, or near the title
- Key patterns: "Key: G", "키: G", "G key", "G 키", or standalone letter
- Common formats: G, A, C, D, E, F, B, Am, Dm, Em, Gm, Bb, Eb, F#, C#m
- If you see chord progressions but no explicit key, identify the key from the first chord

Return ONLY valid JSON, no markdown or other text.`

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
        }
      },
      prompt
    ])

    const text = result.response.text()

    // Clean the response
    let jsonStr = text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('Gemini extraction error:', error)
    return {
      title: 'Unknown',
      ocr_text: ''
    }
  }
}

async function reprocessAllSongs() {
  console.log('Starting Gemini 3 Pro reprocessing...')
  console.log('Model: gemini-3-pro-preview')

  // Get all songs
  const { data: songs, error } = await supabase
    .from('song_images')
    .select('id, image_url, original_filename')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching songs:', error)
    return
  }

  console.log(`Found ${songs?.length || 0} songs to reprocess`)

  let processed = 0
  let failed = 0

  for (let i = 0; i < (songs?.length || 0); i++) {
    const song = songs![i]
    console.log(`\n[${i + 1}/${songs!.length}] ${song.original_filename}`)

    try {
      // Fetch the image from Supabase storage
      const response = await fetch(song.image_url)
      if (!response.ok) {
        console.log('  Failed to fetch image')
        failed++
        continue
      }

      const imageBuffer = await response.arrayBuffer()
      const imageBase64 = Buffer.from(imageBuffer).toString('base64')

      // Determine mime type from filename
      const ext = song.original_filename?.toLowerCase() || ''
      let mimeType = 'image/jpeg'
      if (ext.includes('.png')) mimeType = 'image/png'
      else if (ext.includes('.gif')) mimeType = 'image/gif'
      else if (ext.includes('.webp')) mimeType = 'image/webp'

      // Extract with Gemini
      console.log('  Extracting with Gemini...')
      const info = await extractWithGemini(imageBase64, mimeType)
      console.log(`  Title: ${info.title}`)
      console.log(`  Key: ${info.key || 'Unknown'}`)
      console.log(`  Artist: ${info.artist || 'Unknown'}`)

      // Update database
      const { error: updateError } = await supabase
        .from('song_images')
        .update({
          song_title: info.title || null,
          song_title_korean: info.title_korean || null,
          song_title_english: info.title_english || null,
          song_key: info.key || 'Unknown',
          artist: info.artist || null,
          ocr_text: info.ocr_text || null,
          lyrics_excerpt: info.lyrics_excerpt || null
        })
        .eq('id', song.id)

      if (updateError) {
        console.error('  Update error:', updateError.message)
        failed++
      } else {
        console.log('  ✓ Updated successfully')
        processed++
      }

      // Rate limiting - Gemini has generous limits
      await new Promise(r => setTimeout(r, 500))

    } catch (err) {
      console.error('  Error:', err)
      failed++
    }
  }

  console.log('\n========================================')
  console.log('Gemini reprocessing complete!')
  console.log(`Processed: ${processed}`)
  console.log(`Failed: ${failed}`)
  console.log('========================================')
}

reprocessAllSongs().catch(console.error)
