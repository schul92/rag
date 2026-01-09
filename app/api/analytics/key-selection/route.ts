import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { sessionId, searchId, songId, selectedKey, availableKeys } = await request.json()

    if (!sessionId || !selectedKey) {
      return NextResponse.json({ error: 'sessionId and selectedKey required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error } = await supabase
      .from('analytics_key_selections')
      .insert({
        session_id: sessionId,
        search_id: searchId || null,
        song_id: songId,
        selected_key: selectedKey,
        available_keys: availableKeys || []
      })

    if (error) {
      console.error('[Analytics Key Selection] Insert error:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Analytics Key Selection] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
