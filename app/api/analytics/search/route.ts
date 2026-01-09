import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      query,
      language,
      resultCount,
      responseTimeMs,
      searchType,
      resultSongIds,
      requestedKey,
      isZeroResult,
      // New: similarity tracking
      topSimilarityScore,
      avgSimilarityScore,
      isGoogleFallback
    } = body

    if (!sessionId || !query) {
      return NextResponse.json({ error: 'sessionId and query required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Insert search record
    const { data, error } = await supabase
      .from('analytics_searches')
      .insert({
        session_id: sessionId,
        query,
        query_normalized: query.toLowerCase().trim(),
        language: language || 'ko',
        result_count: resultCount || 0,
        response_time_ms: responseTimeMs,
        search_type: searchType || 'title',
        result_song_ids: resultSongIds || [],
        requested_key: requestedKey,
        is_zero_result: isZeroResult || resultCount === 0,
        // Similarity tracking
        top_similarity_score: topSimilarityScore || null,
        avg_similarity_score: avgSimilarityScore || null,
        is_google_fallback: isGoogleFallback || false
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Analytics Search] Insert error:', error)
      throw error
    }

    // Update session stats (fire and forget)
    supabase
      .rpc('increment_session_searches', { p_session_id: sessionId })
      .then(() => {}, () => {})

    return NextResponse.json({
      success: true,
      searchId: data.id
    })
  } catch (error) {
    console.error('[Analytics Search] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
