/**
 * Extract song metadata from images using Claude Vision
 *
 * This script:
 * 1. Fetches all images from the database
 * 2. Uses Claude Vision to analyze each image
 * 3. Extracts: song_title, song_key
 * 4. Updates the database with clean metadata
 *
 * Run with: npx tsx scripts/extract-metadata-vision.ts
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// Load environment variables
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anthropicKey = process.env.ANTHROPIC_API_KEY!

if (!supabaseUrl || !supabaseKey || !anthropicKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const anthropic = new Anthropic({ apiKey: anthropicKey })

interface SongMetadata {
  song_title: string
  song_title_korean?: string
  song_title_english?: string
  song_key?: string
  artist?: string
  lyrics_excerpt?: string
}

async function extractMetadataFromImage(imageUrl: string): Promise<SongMetadata | null> {
  try {
    // Fetch the image and convert to base64
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.error(`Failed to fetch image: ${imageUrl}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Use Claude Vision to analyze the image
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analyze this chord sheet / music score image and extract the following information.
Return ONLY a JSON object with these fields (no markdown, no explanation):

{
  "song_title": "The main title of the song (in original language)",
  "song_title_korean": "Korean title if present, otherwise null",
  "song_title_english": "English title if present, otherwise null",
  "song_key": "The musical key (e.g., G, A, C, Dm, Eb) if visible, otherwise null",
  "artist": "The artist/composer/songwriter if visible, otherwise null",
  "lyrics_excerpt": "First 2-3 lines of lyrics visible in the image, otherwise null"
}

Important:
- song_title should be the MAIN title, not subtitle
- If title is in Korean, put it in song_title AND song_title_korean
- If title is in English, put it in song_title AND song_title_english
- Look for key signatures like "Key: G" or just "G" or "G major" or "키: G" at the top
- For artist, look for names like "작사", "작곡", "By", composer names
- For lyrics_excerpt, extract the first few lines of actual lyrics (not chord names)
- Return ONLY the JSON, no other text`,
            },
          ],
        },
      ],
    })

    // Parse the response
    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return null
    }

    // Extract JSON from response (handle potential markdown formatting)
    let jsonStr = textContent.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }

    const metadata = JSON.parse(jsonStr) as SongMetadata
    return metadata
  } catch (error) {
    console.error(`Error extracting metadata from ${imageUrl}:`, error)
    return null
  }
}

async function main() {
  console.log('Starting metadata extraction with Claude Vision...\n')

  // First, check if song_title column exists, if not we need to add it
  console.log('Checking database schema...')

  // Fetch all images that need processing
  // We'll process images that don't have a song_title yet
  const { data: images, error } = await supabase
    .from('song_images')
    .select('id, image_url, original_filename, song_key')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching images:', error)
    process.exit(1)
  }

  if (!images || images.length === 0) {
    console.log('No images found in database')
    return
  }

  console.log(`Found ${images.length} images to process\n`)

  // Process each image
  let processed = 0
  let successful = 0
  let failed = 0

  for (const image of images) {
    processed++
    console.log(`[${processed}/${images.length}] Processing: ${image.original_filename}`)

    const metadata = await extractMetadataFromImage(image.image_url)

    if (metadata) {
      // Update the database with extracted metadata
      const { error: updateError } = await supabase
        .from('song_images')
        .update({
          song_title: metadata.song_title,
          song_title_korean: metadata.song_title_korean,
          song_title_english: metadata.song_title_english,
          song_key: metadata.song_key || image.song_key, // Keep existing if not found
          artist: metadata.artist,
          lyrics_excerpt: metadata.lyrics_excerpt,
        })
        .eq('id', image.id)

      if (updateError) {
        console.error(`  Error updating: ${updateError.message}`)
        failed++
      } else {
        console.log(`  ✓ Title: "${metadata.song_title}" | Key: ${metadata.song_key || 'N/A'}`)
        successful++
      }
    } else {
      console.log(`  ✗ Failed to extract metadata`)
      failed++
    }

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log('\n--- Summary ---')
  console.log(`Total processed: ${processed}`)
  console.log(`Successful: ${successful}`)
  console.log(`Failed: ${failed}`)
}

// Run the script
main().catch(console.error)
