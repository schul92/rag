import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { sessionId, searchId, songId, clickPosition, clickType } = await request.json()

    if (!sessionId || !songId) {
      return NextResponse.json({ error: 'sessionId and songId required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('analytics_clicks')
      .insert({
        session_id: sessionId,
        search_id: searchId || null,
        song_id: songId,
        click_position: clickPosition,
        click_type: clickType || 'view'
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Analytics Click] Insert error:', error)
      throw error
    }

    // Update session stats (fire and forget)
    supabase
      .rpc('increment_session_clicks', { p_session_id: sessionId })
      .then(() => {}, () => {})

    return NextResponse.json({
      success: true,
      clickId: data.id
    })
  } catch (error) {
    console.error('[Analytics Click] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { clickId, viewDurationMs } = await request.json()

    if (!clickId) {
      return NextResponse.json({ error: 'clickId required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error } = await supabase
      .from('analytics_clicks')
      .update({ view_duration_ms: viewDurationMs })
      .eq('id', clickId)

    if (error) {
      console.error('[Analytics Click Duration] Update error:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Analytics Click Duration] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
