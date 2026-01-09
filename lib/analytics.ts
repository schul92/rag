// Analytics utilities for user behavior tracking
// Anonymous session-based tracking - no PII collected

const SESSION_KEY = 'fmw_session_id'

// Generate a unique session ID
function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${randomPart}`
}

// Get or create session ID from localStorage
export function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = localStorage.getItem(SESSION_KEY)

  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem(SESSION_KEY, sessionId)
  }

  return sessionId
}

// Get device type from user agent
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'

  const ua = navigator.userAgent.toLowerCase()
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

// Analytics event types
export interface SearchEvent {
  query: string
  language: 'ko' | 'en'
  resultCount: number
  responseTimeMs: number
  searchType?: string
  resultSongIds: string[]
  requestedKey?: string
  isZeroResult: boolean
  // Similarity tracking
  topSimilarityScore?: number  // Highest similarity score (0-1)
  avgSimilarityScore?: number  // Average similarity score
  isGoogleFallback?: boolean   // True if results are from Google API
}

export interface ClickEvent {
  searchId?: string
  songId: string
  clickPosition?: number
  clickType: 'view' | 'expand'
}

export interface DownloadEvent {
  clickId?: string
  songId: string
  downloadType: 'single_page' | 'all_pages' | 'share'
  pageCount: number
  songKey?: string
}

export interface KeySelectionEvent {
  searchId?: string
  songId?: string
  selectedKey: string
  availableKeys: string[]
}

// Track session initialization
export async function trackSession(language: string): Promise<void> {
  try {
    const sessionId = getSessionId()
    if (!sessionId) return

    await fetch('/api/analytics/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        deviceType: getDeviceType(),
        language,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      })
    })
  } catch {
    // Silent fail - analytics should never break UX
  }
}

// Track search event
export async function trackSearch(event: SearchEvent): Promise<string | null> {
  try {
    const sessionId = getSessionId()
    if (!sessionId) return null

    const response = await fetch('/api/analytics/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        ...event
      })
    })

    const data = await response.json()
    return data.searchId || null
  } catch {
    return null
  }
}

// Track click event
export async function trackClick(event: ClickEvent): Promise<string | null> {
  try {
    const sessionId = getSessionId()
    if (!sessionId) return null

    const response = await fetch('/api/analytics/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        ...event
      })
    })

    const data = await response.json()
    return data.clickId || null
  } catch {
    return null
  }
}

// Update view duration when dialog closes
export async function updateViewDuration(clickId: string, viewDurationMs: number): Promise<void> {
  try {
    await fetch('/api/analytics/click', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clickId,
        viewDurationMs
      })
    })
  } catch {
    // Silent fail
  }
}

// Track download event
export async function trackDownload(event: DownloadEvent): Promise<void> {
  try {
    const sessionId = getSessionId()
    if (!sessionId) return

    await fetch('/api/analytics/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        ...event
      })
    })
  } catch {
    // Silent fail
  }
}

// Track key selection event
export async function trackKeySelection(event: KeySelectionEvent): Promise<void> {
  try {
    const sessionId = getSessionId()
    if (!sessionId) return

    await fetch('/api/analytics/key-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        ...event
      })
    })
  } catch {
    // Silent fail
  }
}
