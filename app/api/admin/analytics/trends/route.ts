import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// In-memory cache for trends data (refreshes every 10 minutes)
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30')))
    const granularity = searchParams.get('granularity') || 'daily' // 'hourly' or 'daily'

    const cacheKey = `trends-${days}-${granularity}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    if (granularity === 'hourly' && days <= 7) {
      // Hourly granularity for short ranges
      const { data: searches } = await supabase
        .from('analytics_searches')
        .select('created_at, is_zero_result, response_time_ms, is_google_fallback, session_id')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      const { data: clicks } = await supabase
        .from('analytics_clicks')
        .select('created_at')
        .gte('created_at', startDate.toISOString())

      const { data: downloads } = await supabase
        .from('analytics_downloads')
        .select('created_at')
        .gte('created_at', startDate.toISOString())

      // Aggregate by hour
      const hourlyMap = new Map<string, {
        searches: number
        sessions: Set<string>
        clicks: number
        downloads: number
        zeroResults: number
        responseTimeSum: number
        responseTimeCount: number
        googleFallbacks: number
      }>()

      searches?.forEach(s => {
        const hour = new Date(s.created_at).toISOString().slice(0, 13) + ':00:00.000Z'
        const existing = hourlyMap.get(hour) || {
          searches: 0, sessions: new Set(), clicks: 0, downloads: 0,
          zeroResults: 0, responseTimeSum: 0, responseTimeCount: 0, googleFallbacks: 0
        }
        existing.searches++
        existing.sessions.add(s.session_id)
        if (s.is_zero_result) existing.zeroResults++
        if (s.response_time_ms) {
          existing.responseTimeSum += s.response_time_ms
          existing.responseTimeCount++
        }
        if (s.is_google_fallback) existing.googleFallbacks++
        hourlyMap.set(hour, existing)
      })

      clicks?.forEach(c => {
        const hour = new Date(c.created_at).toISOString().slice(0, 13) + ':00:00.000Z'
        const existing = hourlyMap.get(hour)
        if (existing) existing.clicks++
      })

      downloads?.forEach(d => {
        const hour = new Date(d.created_at).toISOString().slice(0, 13) + ':00:00.000Z'
        const existing = hourlyMap.get(hour)
        if (existing) existing.downloads++
      })

      const trends = Array.from(hourlyMap.entries())
        .map(([hour, stats]) => ({
          timestamp: hour,
          searches: stats.searches,
          sessions: stats.sessions.size,
          clicks: stats.clicks,
          downloads: stats.downloads,
          zeroResultRate: stats.searches > 0 ? Math.round((stats.zeroResults / stats.searches) * 100 * 10) / 10 : 0,
          avgResponseTimeMs: stats.responseTimeCount > 0 ? Math.round(stats.responseTimeSum / stats.responseTimeCount) : 0,
          googleFallbacks: stats.googleFallbacks
        }))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

      const result = { trends, granularity: 'hourly', days }
      cache.set(cacheKey, { data: result, timestamp: Date.now() })
      return NextResponse.json(result)
    }

    // Daily granularity (default)
    const { data: searches } = await supabase
      .from('analytics_searches')
      .select('created_at, is_zero_result, response_time_ms, is_google_fallback, session_id')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    const { data: clicks } = await supabase
      .from('analytics_clicks')
      .select('created_at')
      .gte('created_at', startDate.toISOString())

    const { data: downloads } = await supabase
      .from('analytics_downloads')
      .select('created_at')
      .gte('created_at', startDate.toISOString())

    // Aggregate by day
    const dailyMap = new Map<string, {
      searches: number
      sessions: Set<string>
      clicks: number
      downloads: number
      zeroResults: number
      responseTimeSum: number
      responseTimeCount: number
      googleFallbacks: number
    }>()

    // Initialize all days in range
    for (let d = 0; d < days; d++) {
      const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      dailyMap.set(date, {
        searches: 0, sessions: new Set(), clicks: 0, downloads: 0,
        zeroResults: 0, responseTimeSum: 0, responseTimeCount: 0, googleFallbacks: 0
      })
    }

    searches?.forEach(s => {
      const date = new Date(s.created_at).toISOString().slice(0, 10)
      const existing = dailyMap.get(date)
      if (existing) {
        existing.searches++
        existing.sessions.add(s.session_id)
        if (s.is_zero_result) existing.zeroResults++
        if (s.response_time_ms) {
          existing.responseTimeSum += s.response_time_ms
          existing.responseTimeCount++
        }
        if (s.is_google_fallback) existing.googleFallbacks++
      }
    })

    clicks?.forEach(c => {
      const date = new Date(c.created_at).toISOString().slice(0, 10)
      const existing = dailyMap.get(date)
      if (existing) existing.clicks++
    })

    downloads?.forEach(d => {
      const date = new Date(d.created_at).toISOString().slice(0, 10)
      const existing = dailyMap.get(date)
      if (existing) existing.downloads++
    })

    const trends = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        timestamp: date,
        searches: stats.searches,
        sessions: stats.sessions.size,
        clicks: stats.clicks,
        downloads: stats.downloads,
        zeroResultRate: stats.searches > 0 ? Math.round((stats.zeroResults / stats.searches) * 100 * 10) / 10 : 0,
        avgResponseTimeMs: stats.responseTimeCount > 0 ? Math.round(stats.responseTimeSum / stats.responseTimeCount) : 0,
        googleFallbacks: stats.googleFallbacks
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const result = { trends, granularity: 'daily', days }
    cache.set(cacheKey, { data: result, timestamp: Date.now() })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Trends] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
