/**
 * Google Image Search Fallback
 *
 * When no results found in database, search Google Images
 * for chord sheets. User identifies the key themselves.
 */

export interface GoogleImageResult {
  position: number
  thumbnail: string
  original: string
  source: string
  title: string
  link: string
}

export interface GoogleSearchResponse {
  images: GoogleImageResult[]
  limitReached: boolean
  googleSearchUrl?: string  // URL to open Google Images directly
}

/**
 * Build Google Images search URL for manual fallback
 */
export function buildGoogleImagesUrl(query: string, language: 'ko' | 'en' = 'ko'): string {
  const searchQuery = language === 'ko'
    ? `${query} 악보 코드`
    : `${query} chord sheet`
  return `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`
}

/**
 * Search Google Images for chord sheets using Custom Search API
 * Free tier: 100 queries/day
 * Returns limitReached: true when daily quota is exhausted
 */
export async function searchGoogleImages(
  query: string,
  options: {
    limit?: number
    language?: 'ko' | 'en'
  } = {}
): Promise<GoogleSearchResponse> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_CX
  const { limit = 5, language = 'ko' } = options

  const googleSearchUrl = buildGoogleImagesUrl(query, language)

  if (!apiKey || !cx) {
    console.log('[Google Search] GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX not set, skipping')
    return { images: [], limitReached: false, googleSearchUrl }
  }

  // Build search query for chord sheets
  const searchQuery = language === 'ko'
    ? `${query} 악보 코드`
    : `${query} chord sheet`

  console.log(`[Google Search] Searching: "${searchQuery}"`)

  try {
    const url = `https://www.googleapis.com/customsearch/v1?` +
      `key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}` +
      `&searchType=image&num=${limit}&lr=lang_${language}`

    const response = await fetch(url)
    const data = await response.json()

    // Handle rate limiting / quota exceeded
    if (response.status === 429 || data.error?.code === 429 ||
        data.error?.message?.includes('Quota exceeded') ||
        data.error?.message?.includes('rateLimitExceeded')) {
      console.log('[Google Search] Daily limit reached (100/day)')
      return { images: [], limitReached: true, googleSearchUrl }
    }

    if (data.error) {
      console.error('[Google Search] API Error:', data.error.message)
      return { images: [], limitReached: false, googleSearchUrl }
    }

    if (!data.items) {
      console.log('[Google Search] No results')
      return { images: [], limitReached: false, googleSearchUrl }
    }

    // Map to our interface
    const images: GoogleImageResult[] = data.items
      .slice(0, limit)
      .map((item: {
        link?: string
        image?: { thumbnailLink?: string }
        displayLink?: string
        title?: string
        snippet?: string
      }, index: number) => ({
        position: index + 1,
        thumbnail: item.image?.thumbnailLink || '',
        original: item.link || '',
        source: item.displayLink || '',
        title: item.title || '',
        link: item.link || ''
      }))
      // Filter to only image URLs
      .filter((img: GoogleImageResult) =>
        img.original &&
        (img.original.includes('.jpg') ||
         img.original.includes('.jpeg') ||
         img.original.includes('.png') ||
         img.original.includes('.webp') ||
         img.original.includes('images'))
      )

    console.log(`[Google Search] Found ${images.length} images`)
    return { images, limitReached: false, googleSearchUrl }

  } catch (error) {
    console.error('[Google Search] Error:', error)
    return { images: [], limitReached: false, googleSearchUrl }
  }
}

