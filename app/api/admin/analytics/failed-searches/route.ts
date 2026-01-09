import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cache (refreshes every 3 minutes)
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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30')))

    // Check cache
    const cacheKey = `failed-searches-${range}-${limit}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    const startDate = getDateRange(range)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Try database function first
    const { data: funcData, error: funcError } = await supabase.rpc('get_failed_searches', {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString(),
      p_limit: limit
    })

    if (!funcError && funcData) {
      const result = {
        failedSearches: funcData.map((row: {
          query: string
          query_normalized: string
          search_count: number
          unique_sessions: number
          last_searched_at: string
        }) => ({
          query: row.query,
          normalizedQuery: row.query_normalized,
          searchCount: Number(row.search_count),
          uniqueSessions: Number(row.unique_sessions),
          lastSearchedAt: row.last_searched_at
        })),
        totalFailedSearches: funcData.reduce((sum: number, r: { search_count: number }) => sum + Number(r.search_count), 0),
        uniqueFailedQueries: funcData.length,
        range
      }
      cache.set(cacheKey, { data: result, timestamp: Date.now() })
      return NextResponse.json(result)
    }

    // Fallback: direct query
    const { data: searches } = await supabase
      .from('analytics_searches')
      .select('query_normalized, query, session_id, created_at')
      .gte('created_at', startDate.toISOString())
      .eq('is_zero_result', true)
      .order('created_at', { ascending: false })

    if (!searches || searches.length === 0) {
      const emptyResult = {
        failedSearches: [],
        totalFailedSearches: 0,
        uniqueFailedQueries: 0,
        range
      }
      cache.set(cacheKey, { data: emptyResult, timestamp: Date.now() })
      return NextResponse.json(emptyResult)
    }

    // Aggregate by normalized query
    const queryMap = new Map<string, {
      count: number
      sessions: Set<string>
      originalQuery: string
      lastSearched: Date
    }>()

    searches.forEach(s => {
      const existing = queryMap.get(s.query_normalized)
      if (existing) {
        existing.count++
        existing.sessions.add(s.session_id)
        const searchDate = new Date(s.created_at)
        if (searchDate > existing.lastSearched) {
          existing.lastSearched = searchDate
          existing.originalQuery = s.query
        }
      } else {
        queryMap.set(s.query_normalized, {
          count: 1,
          sessions: new Set([s.session_id]),
          originalQuery: s.query,
          lastSearched: new Date(s.created_at)
        })
      }
    })

    const failedSearches = Array.from(queryMap.entries())
      .map(([normalizedQuery, stats]) => ({
        query: stats.originalQuery,
        normalizedQuery,
        searchCount: stats.count,
        uniqueSessions: stats.sessions.size,
        lastSearchedAt: stats.lastSearched.toISOString()
      }))
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, limit)

    const result = {
      failedSearches,
      totalFailedSearches: searches.length,
      uniqueFailedQueries: queryMap.size,
      range
    }

    cache.set(cacheKey, { data: result, timestamp: Date.now() })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Failed Searches] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
