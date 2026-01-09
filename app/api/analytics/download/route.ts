import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { sessionId, clickId, songId, downloadType, pageCount, songKey } = await request.json()

    if (!sessionId || !songId) {
      return NextResponse.json({ error: 'sessionId and songId required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error } = await supabase
      .from('analytics_downloads')
      .insert({
        session_id: sessionId,
        click_id: clickId || null,
        song_id: songId,
        download_type: downloadType || 'single_page',
        page_count: pageCount || 1,
        song_key: songKey
      })

    if (error) {
      console.error('[Analytics Download] Insert error:', error)
      throw error
    }

    // Update session stats (fire and forget)
    supabase
      .rpc('increment_session_downloads', { p_session_id: sessionId })
      .then(() => {}, () => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Analytics Download] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
