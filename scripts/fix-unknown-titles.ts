import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
// Using native fetch (Node 18+)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' }) // Best accuracy

async function extractSongInfo(imageUrl: string) {
  const prompt = `Analyze this Korean worship song chord sheet image and extract:
1. song_title: The main title of the song (Korean or English)
2. song_key: The musical key (e.g., G, Am, Bb, F#m)
3. ocr_text: All visible text from the image

Return ONLY valid JSON like: {"song_title": "...", "song_key": "...", "ocr_text": "..."}`

  // Retry with exponential backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Fetch image and convert to base64
      const response = await fetch(imageUrl)
      const arrayBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mimeType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg'

      const result = await geminiModel.generateContent([
        { inlineData: { data: base64, mimeType } },
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
      if (err.status === 429 && attempt < 2) {
        const waitTime = Math.pow(2, attempt + 1) * 3000
        console.log(`     Rate limited, waiting ${waitTime/1000}s...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }
      throw error
    }
  }
}

async function fixUnknownTitles() {
  console.log('Fetching images with Unknown/null titles...\n')

  const { data: images, error } = await supabase
    .from('song_images')
    .select('id, original_filename, image_url, song_title')
    .or('song_title.is.null,song_title.eq.Unknown')

  if (error) {
    console.error('Error fetching images:', error)
    return
  }

  console.log(`Found ${images?.length || 0} images to fix\n`)

  let fixed = 0
  let failed = 0

  for (let i = 0; i < (images?.length || 0); i++) {
    const img = images![i]
    console.log(`[${i + 1}/${images!.length}] Processing: ${img.original_filename}`)

    try {
      const info = await extractSongInfo(img.image_url)

      if (info.song_title && info.song_title !== 'Unknown') {
        console.log(`     Title: ${info.song_title}`)
        console.log(`     Key: ${info.song_key || 'N/A'}`)

        const { error: updateError } = await supabase
          .from('song_images')
          .update({
            song_title: info.song_title,
            song_key: info.song_key || null,
            ocr_text: info.ocr_text || null,
          })
          .eq('id', img.id)

        if (updateError) {
          console.log(`     Failed to update: ${updateError.message}`)
          failed++
        } else {
          console.log(`     Updated!`)
          fixed++
        }
      } else {
        console.log(`     Could not extract title`)
        failed++
      }
    } catch (error) {
      console.log(`     Error:`, error)
      failed++
    }

    // Wait 1.5 seconds between requests (faster processing)
    if (i < images!.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }

  console.log(`\n========================================`)
  console.log(`Fixed: ${fixed}, Failed: ${failed}`)
  console.log(`========================================`)
}

fixUnknownTitles()
