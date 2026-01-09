import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cache for total count (refreshes every 5 minutes)
let cachedTotalCount: { count: number; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const zeroResultOnly = searchParams.get('zeroResultOnly') === 'true'
    const search = searchParams.get('search')?.toLowerCase().trim()

    const offset = (page - 1) * limit

    // Calculate date range
    const now = new Date()
    let startDate: Date
    switch (range) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Build query with filters
    let query = supabase
      .from('analytics_searches')
      .select('id, session_id, query, language, result_count, response_time_ms, top_similarity_score, avg_similarity_score, is_zero_result, is_google_fallback, search_type, created_at', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (zeroResultOnly) {
      query = query.eq('is_zero_result', true)
    }

    if (search) {
      query = query.ilike('query', `%${search}%`)
    }

    const { data, count, error } = await query

    if (error) {
      console.error('[Search Logs] Query error:', error)
      throw error
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      logs: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        range,
        zeroResultOnly,
        search: search || null
      }
    })
  } catch (error) {
    console.error('[Search Logs] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
