'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Users,
  MousePointer,
  Download,
  AlertTriangle,
  TrendingUp,
  Music,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Zap,
  ExternalLink,
  Filter,
  List,
  Globe
} from 'lucide-react'

interface Summary {
  totalSessions: number
  totalSearches: number
  totalClicks: number
  totalDownloads: number
  zeroResultSearches: number
  zeroResultRate: number
  avgResponseTimeMs: number
  avgSimilarityScore: number
  googleFallbackCount: number
  googleFallbackRate: number
}

interface TopSearch {
  query: string
  search_count: number
  zero_result_count: number
  avg_response_time_ms: number | null
  avg_similarity_score: number | null
}

interface PopularSong {
  song_id: string
  song_title: string
  unique_viewers: number
  total_downloads: number
  popularity_score: number
}

interface FailedSearch {
  query: string
  normalizedQuery: string
  searchCount: number
  uniqueSessions: number
}

interface SearchLog {
  id: string
  session_id: string
  query: string
  language: string
  result_count: number
  response_time_ms: number | null
  top_similarity_score: number | null
  is_zero_result: boolean
  is_google_fallback: boolean
  created_at: string
}

interface TrendPoint {
  timestamp: string
  searches: number
  sessions: number
  clicks: number
  downloads: number
  zeroResultRate: number
  avgResponseTimeMs: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const timeRanges = [
  { value: '1h', label: '1시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'all', label: '전체' },
]

const tabs = [
  { id: 'overview', label: '개요', icon: TrendingUp },
  { id: 'logs', label: '검색 로그', icon: List },
]

export default function AnalyticsDashboard() {
  const [range, setRange] = useState('7d')
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [topSearches, setTopSearches] = useState<TopSearch[]>([])
  const [popularSongs, setPopularSongs] = useState<PopularSong[]>([])
  const [failedSearches, setFailedSearches] = useState<FailedSearch[]>([])
  const [trends, setTrends] = useState<TrendPoint[]>([])

  // Search logs state
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([])
  const [logsPagination, setLogsPagination] = useState<Pagination | null>(null)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)
  const [zeroResultOnly, setZeroResultOnly] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  const fetchOverviewData = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryRes, searchesRes, songsRes, failedRes, trendsRes] = await Promise.all([
        fetch(`/api/admin/analytics/summary?range=${range}`),
        fetch(`/api/admin/analytics/top-searches?range=${range}&limit=15`),
        fetch(`/api/admin/analytics/popular-songs?limit=15`),
        fetch(`/api/admin/analytics/failed-searches?range=${range}&limit=20`),
        fetch(`/api/admin/analytics/trends?days=${range === '24h' ? 1 : range === '7d' ? 7 : 30}`)
      ])

      const [summaryData, searchesData, songsData, failedData, trendsData] = await Promise.all([
        summaryRes.json(),
        searchesRes.json(),
        songsRes.json(),
        failedRes.json(),
        trendsRes.json()
      ])

      setSummary(summaryData)
      setTopSearches(searchesData.topSearches || [])
      setPopularSongs(songsData.popularSongs || [])
      setFailedSearches(failedData.failedSearches || [])
      setTrends(trendsData.trends || [])
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [range])

  const fetchSearchLogs = useCallback(async (page: number = 1) => {
    setLogsLoading(true)
    try {
      const params = new URLSearchParams({
        range,
        page: page.toString(),
        limit: '25',
        zeroResultOnly: zeroResultOnly.toString()
      })
      if (searchFilter) params.set('search', searchFilter)

      const res = await fetch(`/api/admin/analytics/search-logs?${params}`)
      const data = await res.json()

      setSearchLogs(data.logs || [])
      setLogsPagination(data.pagination || null)
    } catch (error) {
      console.error('Error fetching search logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }, [range, zeroResultOnly, searchFilter])

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverviewData()
    } else if (activeTab === 'logs') {
      fetchSearchLogs(logsPage)
    }
  }, [activeTab, range, fetchOverviewData, fetchSearchLogs, logsPage])

  useEffect(() => {
    if (activeTab === 'logs') {
      setLogsPage(1)
      fetchSearchLogs(1)
    }
  }, [zeroResultOnly, searchFilter, activeTab, fetchSearchLogs])

  const SummaryCard = ({
    title,
    value,
    icon: Icon,
    subtitle,
    color = 'amber'
  }: {
    title: string
    value: number | string
    icon: React.ElementType
    subtitle?: string
    color?: string
  }) => (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <p className="text-xl font-bold mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-full bg-${color}-500/10 shrink-0`}>
          <Icon className={`w-4 h-4 text-${color}-500`} />
        </div>
      </div>
    </Card>
  )

  const formatTime = (date: string) => {
    return new Date(date).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const maxSearches = Math.max(...trends.map(t => t.searches), 1)

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground">사용자 검색 행동 분석</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-muted rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-background shadow text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Time Range */}
            <div className="relative">
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="appearance-none bg-card border border-border rounded-lg px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {timeRanges.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => activeTab === 'overview' ? fetchOverviewData() : fetchSearchLogs(logsPage)}
              disabled={loading || logsLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={`w-4 h-4 ${(loading || logsLoading) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {activeTab === 'overview' ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <SummaryCard title="세션" value={summary?.totalSessions || 0} icon={Users} color="blue" />
              <SummaryCard title="검색" value={summary?.totalSearches || 0} icon={Search} color="amber" />
              <SummaryCard title="클릭" value={summary?.totalClicks || 0} icon={MousePointer} color="green" />
              <SummaryCard title="다운로드" value={summary?.totalDownloads || 0} icon={Download} color="purple" />
              <SummaryCard
                title="실패율"
                value={`${summary?.zeroResultRate || 0}%`}
                icon={AlertTriangle}
                subtitle={`${summary?.zeroResultSearches || 0}건`}
                color="red"
              />
              <SummaryCard
                title="Google 검색"
                value={summary?.googleFallbackCount || 0}
                icon={Globe}
                subtitle={`${summary?.googleFallbackRate || 0}%`}
                color="blue"
              />
              <SummaryCard
                title="응답시간"
                value={`${summary?.avgResponseTimeMs || 0}ms`}
                icon={Zap}
                subtitle={`유사도: ${((summary?.avgSimilarityScore || 0) * 100).toFixed(1)}%`}
                color="cyan"
              />
            </div>

            {/* Trends Chart */}
            {trends.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium">검색 추이</h2>
                </div>
                <div className="h-32 flex items-end gap-1">
                  {trends.map((point, i) => (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center group relative"
                    >
                      <div
                        className="w-full bg-amber-500/80 rounded-t transition-all hover:bg-amber-500"
                        style={{ height: `${(point.searches / maxSearches) * 100}%`, minHeight: point.searches > 0 ? '4px' : '0' }}
                      />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover border rounded px-2 py-1 text-xs shadow-lg z-10 whitespace-nowrap">
                        <div className="font-medium">{point.timestamp.slice(5, 10)}</div>
                        <div>검색: {point.searches}</div>
                        <div>세션: {point.sessions}</div>
                        <div>실패율: {point.zeroResultRate}%</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>{trends[0]?.timestamp.slice(5, 10)}</span>
                  <span>{trends[trends.length - 1]?.timestamp.slice(5, 10)}</span>
                </div>
              </Card>
            )}

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Top Searches */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-medium">인기 검색어</h2>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : topSearches.length === 0 ? (
                  <p className="text-muted-foreground text-sm">데이터가 없습니다</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {topSearches.map((search, index) => (
                      <div
                        key={search.query}
                        className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground w-5 shrink-0">{index + 1}</span>
                          <span className="truncate">{search.query}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground">{search.search_count}회</span>
                          {search.zero_result_count > 0 && (
                            <span className="text-xs text-red-500">({search.zero_result_count})</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Popular Songs */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Music className="w-4 h-4 text-purple-500" />
                  <h2 className="text-sm font-medium">인기 악보</h2>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : popularSongs.length === 0 ? (
                  <p className="text-muted-foreground text-sm">데이터가 없습니다</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {popularSongs.map((song, index) => (
                      <div
                        key={song.song_id}
                        className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground w-5 shrink-0">{index + 1}</span>
                          <span className="truncate">{song.song_title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                          <span className="flex items-center gap-0.5">
                            <MousePointer className="w-3 h-3" />{song.unique_viewers}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Download className="w-3 h-3" />{song.total_downloads}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Failed Searches */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-medium">검색 실패 (추가 필요 악보)</h2>
                <span className="text-xs text-muted-foreground">이 곡들을 추가하면 사용자 경험이 개선됩니다</span>
              </div>
              {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : failedSearches.length === 0 ? (
                <p className="text-muted-foreground text-sm">검색 실패 데이터가 없습니다</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {failedSearches.map((search) => (
                    <div
                      key={search.normalizedQuery}
                      className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/10 text-sm"
                    >
                      <span className="truncate">{search.query}</span>
                      <span className="text-xs text-red-500 shrink-0 ml-2">{search.searchCount}회</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        ) : (
          /* Search Logs Tab */
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">검색 로그</h2>
                {logsPagination && (
                  <span className="text-xs text-muted-foreground">
                    ({logsPagination.total.toLocaleString()}건)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <input
                    type="text"
                    placeholder="검색어 필터..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full sm:w-48 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  onClick={() => setZeroResultOnly(!zeroResultOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    zeroResultOnly
                      ? 'bg-red-500/10 border-red-500/30 text-red-500'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">실패만</span>
                </button>
              </div>
            </div>

            {logsLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : searchLogs.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">검색 로그가 없습니다</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">시간</th>
                        <th className="pb-2 font-medium">검색어</th>
                        <th className="pb-2 font-medium text-center">결과</th>
                        <th className="pb-2 font-medium text-center">응답</th>
                        <th className="pb-2 font-medium text-center">유사도</th>
                        <th className="pb-2 font-medium text-center">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {searchLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30">
                          <td className="py-2 text-muted-foreground whitespace-nowrap">
                            {formatTime(log.created_at)}
                          </td>
                          <td className="py-2 max-w-[200px] truncate">{log.query}</td>
                          <td className="py-2 text-center">{log.result_count}</td>
                          <td className="py-2 text-center text-muted-foreground">
                            {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
                          </td>
                          <td className="py-2 text-center">
                            {log.top_similarity_score
                              ? `${(log.top_similarity_score * 100).toFixed(0)}%`
                              : '-'}
                          </td>
                          <td className="py-2 text-center">
                            {log.is_zero_result ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-500/10 text-red-500">
                                실패
                              </span>
                            ) : log.is_google_fallback ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-500">
                                <ExternalLink className="w-3 h-3 mr-0.5" />G
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-500">
                                성공
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsPagination && logsPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {((logsPagination.page - 1) * logsPagination.limit) + 1} - {Math.min(logsPagination.page * logsPagination.limit, logsPagination.total)} / {logsPagination.total.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLogsPage(p => p - 1)}
                        disabled={!logsPagination.hasPrev}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="px-3 text-sm">
                        {logsPagination.page} / {logsPagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLogsPage(p => p + 1)}
                        disabled={!logsPagination.hasNext}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>데이터는 익명으로 수집되며 개인정보를 포함하지 않습니다.</p>
        </div>
      </div>
    </div>
  )
}
