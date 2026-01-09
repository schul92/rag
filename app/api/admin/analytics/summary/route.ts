import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cache for summary stats (refreshes every 2 minutes)
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 2 * 60 * 1000

function getDateRange(range: string): Date {
  const now = new Date()
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000)
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default:
      return new Date(0) // All time
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d'

    // Check cache
    const cacheKey = `summary-${range}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    const startDate = getDateRange(range)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parallel queries for all stats
    const [
      sessionsResult,
      searchStatsResult,
      clicksResult,
      downloadsResult
    ] = await Promise.all([
      // Unique sessions
      supabase
        .from('analytics_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString()),

      // Search stats with aggregates
      supabase
        .from('analytics_searches')
        .select('is_zero_result, response_time_ms, top_similarity_score, is_google_fallback')
        .gte('created_at', startDate.toISOString()),

      // Clicks
      supabase
        .from('analytics_clicks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString()),

      // Downloads
      supabase
        .from('analytics_downloads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
    ])

    // Calculate search stats
    const searches = searchStatsResult.data || []
    const totalSearches = searches.length
    const zeroResults = searches.filter(s => s.is_zero_result).length
    const googleFallbacks = searches.filter(s => s.is_google_fallback).length

    const responseTimes = searches
      .map(s => s.response_time_ms)
      .filter((t): t is number => t !== null && t !== undefined)
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0

    const similarityScores = searches
      .map(s => s.top_similarity_score)
      .filter((s): s is number => s !== null && s !== undefined)
    const avgSimilarity = similarityScores.length > 0
      ? Math.round((similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length) * 10000) / 10000
      : 0

    const zeroResultRate = totalSearches > 0
      ? Math.round((zeroResults / totalSearches) * 1000) / 10
      : 0

    const result = {
      totalSessions: sessionsResult.count || 0,
      totalSearches,
      totalClicks: clicksResult.count || 0,
      totalDownloads: downloadsResult.count || 0,
      zeroResultSearches: zeroResults,
      zeroResultRate,
      avgResponseTimeMs: avgResponseTime,
      avgSimilarityScore: avgSimilarity,
      googleFallbackCount: googleFallbacks,
      googleFallbackRate: totalSearches > 0
        ? Math.round((googleFallbacks / totalSearches) * 1000) / 10
        : 0,
      range,
      cachedAt: new Date().toISOString()
    }

    // Update cache
    cache.set(cacheKey, { data: result, timestamp: Date.now() })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Analytics Summary] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
