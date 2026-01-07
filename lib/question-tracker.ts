import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface QuestionTrackingData {
  // Question content
  user_query: string
  query_language?: 'ko' | 'en'

  // Query classification
  is_key_query?: boolean
  requested_key?: string
  requested_count?: number
  is_specific_song?: boolean
  needs_help?: boolean
  clean_search_terms?: string

  // Search results metadata
  search_method?: 'hybrid' | 'key_list' | 'google_fallback'
  raw_results_count?: number
  grouped_results_count?: number
  shown_results_count?: number
  used_reranking?: boolean
  used_claude_fallback?: boolean

  // Response metadata
  response_type?: 'results' | 'key_selection' | 'no_results' | 'error'
  needs_key_selection?: boolean

  // Performance metrics
  processing_time_ms?: number

  // Request metadata
  user_agent?: string
}

/**
 * Tracks a user question to the database.
 * This function is non-blocking and will not throw errors to avoid affecting the main request.
 */
export async function trackQuestion(
  supabase: SupabaseClient,
  data: QuestionTrackingData
): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_questions')
      .insert([{
        user_query: data.user_query,
        query_language: data.query_language,
        is_key_query: data.is_key_query ?? false,
        requested_key: data.requested_key,
        requested_count: data.requested_count,
        is_specific_song: data.is_specific_song ?? false,
        needs_help: data.needs_help ?? false,
        clean_search_terms: data.clean_search_terms,
        search_method: data.search_method,
        raw_results_count: data.raw_results_count ?? 0,
        grouped_results_count: data.grouped_results_count ?? 0,
        shown_results_count: data.shown_results_count ?? 0,
        used_reranking: data.used_reranking ?? false,
        used_claude_fallback: data.used_claude_fallback ?? false,
        response_type: data.response_type,
        needs_key_selection: data.needs_key_selection ?? false,
        processing_time_ms: data.processing_time_ms,
        user_agent: data.user_agent,
      }])

    if (error) {
      // Log error but don't throw - tracking should never break the main flow
      console.error('[Question Tracker] Failed to track question:', error.message)
    }
  } catch (err) {
    // Silently catch any errors - tracking failure should not affect user experience
    console.error('[Question Tracker] Unexpected error:', err)
  }
}

/**
 * Creates a tracker instance that can collect data throughout the request lifecycle
 * and save it at the end.
 */
export function createQuestionTracker(supabase: SupabaseClient, userAgent?: string) {
  const startTime = Date.now()
  const data: QuestionTrackingData = {
    user_query: '',
    user_agent: userAgent,
  }

  return {
    // Set initial query data
    setQuery(query: string, language?: 'ko' | 'en') {
      data.user_query = query
      data.query_language = language
    },

    // Set query classification
    setClassification(classification: {
      isKeyQuery?: boolean
      requestedKey?: string
      requestedCount?: number
      isSpecificSong?: boolean
      needsHelp?: boolean
      cleanSearchTerms?: string
    }) {
      data.is_key_query = classification.isKeyQuery
      data.requested_key = classification.requestedKey
      data.requested_count = classification.requestedCount
      data.is_specific_song = classification.isSpecificSong
      data.needs_help = classification.needsHelp
      data.clean_search_terms = classification.cleanSearchTerms
    },

    // Set search results
    setSearchResults(results: {
      method?: 'hybrid' | 'key_list' | 'google_fallback'
      rawCount?: number
      groupedCount?: number
      shownCount?: number
      usedReranking?: boolean
      usedClaudeFallback?: boolean
    }) {
      data.search_method = results.method
      data.raw_results_count = results.rawCount
      data.grouped_results_count = results.groupedCount
      data.shown_results_count = results.shownCount
      data.used_reranking = results.usedReranking
      data.used_claude_fallback = results.usedClaudeFallback
    },

    // Set response metadata
    setResponse(response: {
      type?: 'results' | 'key_selection' | 'no_results' | 'error'
      needsKeySelection?: boolean
    }) {
      data.response_type = response.type
      data.needs_key_selection = response.needsKeySelection
    },

    // Save the tracked data (call this at the end of the request)
    async save() {
      data.processing_time_ms = Date.now() - startTime
      await trackQuestion(supabase, data)
    },

    // Get the collected data (for debugging)
    getData() {
      return { ...data, processing_time_ms: Date.now() - startTime }
    },
  }
}
