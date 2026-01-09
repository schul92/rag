import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cache for top searches (refreshes every 3 minutes)
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 3 * 60 * 1000

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
      return new Date(0)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d'
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    // Check cache
    const cacheKey = `top-searches-${range}-${limit}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    const startDate = getDateRange(range)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Try to use database function first (more efficient)
    const { data: funcData, error: funcError } = await supabase.rpc('get_top_searches', {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
      p_limit: limit
    })

    if (!funcError && funcData) {
      const result = {
        topSearches: funcData.map((row: {
          query: string
          search_count: number
          zero_result_count: number
          avg_response_time_ms: number
          avg_similarity_score: number
          last_searched_at: string
        }) => ({
          query: row.query,
          search_count: Number(row.search_count),
          zero_result_count: Number(row.zero_result_count),
          avg_response_time_ms: row.avg_response_time_ms,
          avg_similarity_score: row.avg_similarity_score,
          last_searched_at: row.last_searched_at
        })),
        range
      }
      cache.set(cacheKey, { data: result, timestamp: Date.now() })
      return NextResponse.json(result)
    }

    // Fallback: direct query with in-memory aggregation
    // Only fetch what we need for aggregation
    const { data: searches } = await supabase
      .from('analytics_searches')
      .select('query_normalized, query, is_zero_result, response_time_ms, top_similarity_score, created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (!searches || searches.length === 0) {
      const emptyResult = { topSearches: [], range }
      cache.set(cacheKey, { data: emptyResult, timestamp: Date.now() })
      return NextResponse.json(emptyResult)
    }

    // Aggregate by normalized query
    const queryMap = new Map<string, {
      count: number
      zeroCount: number
      originalQuery: string
      responseTimes: number[]
      similarityScores: number[]
      lastSearched: Date
    }>()

    searches.forEach(s => {
      const existing = queryMap.get(s.query_normalized)
      if (existing) {
        existing.count++
        if (s.is_zero_result) existing.zeroCount++
        if (s.response_time_ms) existing.responseTimes.push(s.response_time_ms)
        if (s.top_similarity_score) existing.similarityScores.push(s.top_similarity_score)
        const searchDate = new Date(s.created_at)
        if (searchDate > existing.lastSearched) {
          existing.lastSearched = searchDate
          existing.originalQuery = s.query
        }
      } else {
        queryMap.set(s.query_normalized, {
          count: 1,
          zeroCount: s.is_zero_result ? 1 : 0,
          originalQuery: s.query,
          responseTimes: s.response_time_ms ? [s.response_time_ms] : [],
          similarityScores: s.top_similarity_score ? [s.top_similarity_score] : [],
          lastSearched: new Date(s.created_at)
        })
      }
    })

    const topSearches = Array.from(queryMap.entries())
      .map(([, stats]) => ({
        query: stats.originalQuery,
        search_count: stats.count,
        zero_result_count: stats.zeroCount,
        avg_response_time_ms: stats.responseTimes.length > 0
          ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
          : null,
        avg_similarity_score: stats.similarityScores.length > 0
          ? Math.round((stats.similarityScores.reduce((a, b) => a + b, 0) / stats.similarityScores.length) * 10000) / 10000
          : null,
        last_searched_at: stats.lastSearched.toISOString()
      }))
      .sort((a, b) => b.search_count - a.search_count)
      .slice(0, limit)

    const result = { topSearches, range }
    cache.set(cacheKey, { data: result, timestamp: Date.now() })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Top Searches] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
