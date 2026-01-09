import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { sessionId, deviceType, language, userAgent } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Upsert session (create if new, update last_active if exists)
    const { error } = await supabase
      .from('analytics_sessions')
      .upsert(
        {
          session_id: sessionId,
          user_agent: userAgent,
          language,
          device_type: deviceType,
          last_active_at: new Date().toISOString()
        },
        {
          onConflict: 'session_id',
          ignoreDuplicates: false
        }
      )

    if (error) {
      console.error('[Analytics Session] Error:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Analytics Session] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
