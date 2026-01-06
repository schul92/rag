/**
 * Re-embed all songs with voyage-3-large (1024d)
 * Best overall + multilingual embeddings
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3-large'  // Best overall + multilingual, 1024d

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

async function reembedSongs() {
  console.log('Re-embedding all songs with voyage-3-large (1024d)')
  console.log('Best overall + multilingual model\n')

  // Get all songs
  const { data: songs, error } = await supabase
    .from('song_images')
    .select('id, song_title, song_title_korean, song_title_english, ocr_text')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching songs:', error)
    return
  }

  console.log(`Found ${songs?.length || 0} songs to re-embed\n`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < (songs?.length || 0); i++) {
    const song = songs![i]
    console.log(`[${i + 1}/${songs!.length}] ${song.song_title || 'Unknown'}`)

    // Build text for embedding
    const textForEmbedding = [
      song.song_title,
      song.song_title_korean,
      song.song_title_english,
      (song.ocr_text || '').slice(0, 1000) // Limit OCR text
    ].filter(Boolean).join(' ').trim()

    if (!textForEmbedding) {
      console.log('  Skipping: No text to embed')
      continue
    }

    try {
      // Generate multilingual embedding
      const embedding = await generateEmbedding(textForEmbedding)
      console.log(`  Generated ${embedding.length}d embedding`)

      // Update database - write to embedding_multilingual column
      const { error: updateError } = await supabase
        .from('song_images')
        .update({
          embedding_multilingual: embedding
        })
        .eq('id', song.id)

      if (updateError) {
        console.error('  Update error:', updateError)
        errorCount++
      } else {
        console.log('  ✓ Saved!')
        successCount++
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 1500))

    } catch (err) {
      console.error('  Error:', err)
      errorCount++
    }
  }

  console.log('\n========================================')
  console.log('Re-embedding complete!')
  console.log(`  Success: ${successCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log('========================================')
}

reembedSongs().catch(console.error)
