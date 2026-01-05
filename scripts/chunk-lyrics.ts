/**
 * Phase 3: Lyrics Chunk Processing
 *
 * Split OCR text into individual lines and create embeddings for each.
 * This enables searching by partial lyrics ("나 같은 죄인 살리신")
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[] }>
}

// Batch embedding - much faster!
async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'voyage-multilingual-2',
      input: texts, // Array of texts for batch processing
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voyage AI API error: ${response.status} - ${error}`)
  }

  const data: VoyageEmbeddingResponse = await response.json()
  return data.data.map(d => d.embedding)
}

// Clean and split OCR text into meaningful chunks
function splitIntoChunks(ocrText: string): string[] {
  if (!ocrText) return []

  // Split by newlines
  const lines = ocrText.split(/\n+/)
    .map(line => line.trim())
    .filter(line => {
      // Skip very short lines (likely chord notations)
      if (line.length < 5) return false
      // Skip lines that are mostly chord symbols
      if (/^[A-G][#b]?m?(7|maj7|sus4|add9)?(\s+[A-G][#b]?m?(7|maj7|sus4|add9)?)*$/.test(line)) return false
      // Skip lines that are mostly numbers or punctuation
      if (/^[\d\s\.\-\(\)]+$/.test(line)) return false
      return true
    })

  // Group short lines together (2-3 lines per chunk for context)
  const chunks: string[] = []
  let currentChunk: string[] = []

  for (const line of lines) {
    currentChunk.push(line)

    // If chunk has 2-3 lines or is long enough, save it
    if (currentChunk.length >= 2 || currentChunk.join(' ').length > 50) {
      chunks.push(currentChunk.join(' '))
      currentChunk = []
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '))
  }

  return chunks
}

async function processLyricsChunks() {
  console.log('Starting lyrics chunk processing...')
  console.log('Model: voyage-multilingual-2 (Korean-optimized)')

  // Get all songs
  const { data: songs, error } = await supabase
    .from('song_images')
    .select('id, song_title, ocr_text')
    .not('ocr_text', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching songs:', error)
    return
  }

  console.log(`Found ${songs?.length || 0} songs to process`)

  let totalChunks = 0
  let processedSongs = 0

  for (let i = 0; i < (songs?.length || 0); i++) {
    const song = songs![i]
    console.log(`\n[${i + 1}/${songs!.length}] ${song.song_title || 'Unknown'}`)

    // Check if already processed
    const { data: existing } = await supabase
      .from('lyrics_chunks')
      .select('id')
      .eq('song_image_id', song.id)
      .limit(1)

    if (existing && existing.length > 0) {
      console.log('  Already processed, skipping...')
      continue
    }

    // Split into chunks
    const chunks = splitIntoChunks(song.ocr_text || '')
    console.log(`  Found ${chunks.length} lyrics chunks`)

    if (chunks.length === 0) {
      console.log('  No valid chunks, skipping...')
      continue
    }

    try {
      // Generate ALL embeddings in one batch API call (much faster!)
      const embeddings = await generateBatchEmbeddings(chunks)

      // Batch insert all chunks at once
      const chunkRecords = chunks.map((chunkText, j) => ({
        song_image_id: song.id,
        chunk_text: chunkText,
        chunk_order: j + 1,
        embedding: embeddings[j]
      }))

      const { error: insertError } = await supabase
        .from('lyrics_chunks')
        .insert(chunkRecords)

      if (insertError) {
        console.error(`  Insert error:`, insertError.message)
      } else {
        totalChunks += chunks.length
        processedSongs++
        console.log(`  ✓ Created ${chunks.length} chunks`)
      }
    } catch (err) {
      console.error(`  Failed:`, err)
    }

    // Small delay between songs (just 200ms now)
    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n========================================')
  console.log(`Lyrics chunking complete!`)
  console.log(`Songs processed: ${processedSongs}`)
  console.log(`Total chunks created: ${totalChunks}`)
  console.log('========================================')
}

processLyricsChunks().catch(console.error)
