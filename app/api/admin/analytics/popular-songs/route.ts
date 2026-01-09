import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Try materialized view first
    const { data: viewData, error: viewError } = await supabase
      .from('song_popularity')
      .select('*')
      .order('popularity_score', { ascending: false })
      .limit(limit)

    if (viewError) {
      // Fallback: direct aggregation
      const { data: clicks } = await supabase
        .from('analytics_clicks')
        .select('song_id')

      const { data: downloads } = await supabase
        .from('analytics_downloads')
        .select('song_id')

      // Aggregate
      const scoreMap = new Map<string, { views: number; downloads: number }>()

      clicks?.forEach(c => {
        const existing = scoreMap.get(c.song_id) || { views: 0, downloads: 0 }
        existing.views++
        scoreMap.set(c.song_id, existing)
      })

      downloads?.forEach(d => {
        const existing = scoreMap.get(d.song_id) || { views: 0, downloads: 0 }
        existing.downloads++
        scoreMap.set(d.song_id, existing)
      })

      // Get song titles
      const songIds = Array.from(scoreMap.keys())
      const { data: songs } = await supabase
        .from('song_images')
        .select('id, song_title')
        .in('id', songIds)

      const songTitles = new Map(songs?.map(s => [s.id, s.song_title]) || [])

      const popularSongs = Array.from(scoreMap.entries())
        .map(([songId, stats]) => ({
          song_id: songId,
          song_title: songTitles.get(songId) || 'Unknown',
          unique_viewers: stats.views,
          total_downloads: stats.downloads,
          popularity_score: stats.views + stats.downloads * 3
        }))
        .sort((a, b) => b.popularity_score - a.popularity_score)
        .slice(0, limit)

      return NextResponse.json({ popularSongs })
    }

    // Enrich with song titles
    const songIds = viewData.map(s => s.song_id)
    const { data: songs } = await supabase
      .from('song_images')
      .select('id, song_title')
      .in('id', songIds)

    const songTitles = new Map(songs?.map(s => [s.id, s.song_title]) || [])

    const enrichedData = viewData.map(s => ({
      ...s,
      song_title: songTitles.get(s.song_id) || 'Unknown'
    }))

    return NextResponse.json({ popularSongs: enrichedData })
  } catch (error) {
    console.error('[Popular Songs] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
