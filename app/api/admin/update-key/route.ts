import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * API to update song key(s) for a specific song
 *
 * Supports multiple keys stored as comma-separated values (e.g., "D, B")
 * This handles sheets that have both original and transposed keys
 *
 * POST /api/admin/update-key
 * Body: { songTitle: string, newKey: string }
 *
 * Example: { songTitle: "저 들 밖에 한밤중에", newKey: "D, B" }
 */
export async function POST(request: NextRequest) {
  try {
    const { songTitle, newKey, songId } = await request.json()

    if (!newKey || typeof newKey !== 'string') {
      return NextResponse.json({ error: 'newKey is required' }, { status: 400 })
    }

    if (!songTitle && !songId) {
      return NextResponse.json({ error: 'Either songTitle or songId is required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Normalize key format: "D, B" or "D/B" -> "D, B"
    const normalizedKey = newKey
      .toUpperCase()
      .replace(/\s*[\/,]\s*/g, ', ')
      .trim()

    let query = supabase
      .from('song_images')
      .update({ song_key: normalizedKey })

    if (songId) {
      query = query.eq('id', songId)
    } else {
      // Update all pages of the song with this title
      query = query.ilike('song_title', `%${songTitle}%`)
    }

    const { data, error, count } = await query.select()

    if (error) {
      console.error('[Update Key] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Update Key] Updated ${data?.length || 0} records for "${songTitle || songId}" to key "${normalizedKey}"`)

    return NextResponse.json({
      success: true,
      updatedCount: data?.length || 0,
      newKey: normalizedKey,
      updatedSongs: data?.map(s => ({
        id: s.id,
        title: s.song_title,
        filename: s.original_filename,
        key: s.song_key
      }))
    })
  } catch (error) {
    console.error('[Update Key] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/admin/update-key?title=저들밖에
 *
 * Get current key info for a song (for debugging)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title')

    if (!title) {
      return NextResponse.json({ error: 'title parameter is required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('song_images')
      .select('id, song_title, song_key, original_filename')
      .ilike('song_title', `%${title}%`)
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      count: data?.length || 0,
      songs: data
    })
  } catch (error) {
    console.error('[Get Key] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
