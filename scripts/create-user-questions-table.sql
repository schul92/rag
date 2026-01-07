-- Migration: Create user_questions table for tracking and analytics
-- Run this in your Supabase SQL Editor

-- Create the user_questions table
CREATE TABLE IF NOT EXISTS user_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Question content
  user_query TEXT NOT NULL,
  query_language VARCHAR(2),  -- 'ko' or 'en'

  -- Query classification
  is_key_query BOOLEAN DEFAULT false,
  requested_key VARCHAR(10),
  requested_count INTEGER,
  is_specific_song BOOLEAN DEFAULT false,
  needs_help BOOLEAN DEFAULT false,
  clean_search_terms TEXT,

  -- Search results metadata
  search_method VARCHAR(50),  -- 'hybrid', 'key_list', 'google_fallback'
  raw_results_count INTEGER DEFAULT 0,
  grouped_results_count INTEGER DEFAULT 0,
  shown_results_count INTEGER DEFAULT 0,
  used_reranking BOOLEAN DEFAULT false,
  used_claude_fallback BOOLEAN DEFAULT false,

  -- Response metadata
  response_type VARCHAR(50),  -- 'results', 'key_selection', 'no_results', 'error'
  needs_key_selection BOOLEAN DEFAULT false,

  -- Performance metrics
  processing_time_ms INTEGER,

  -- Request metadata (optional, for debugging)
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common analytics queries
CREATE INDEX IF NOT EXISTS idx_user_questions_created_at ON user_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_questions_language ON user_questions(query_language);
CREATE INDEX IF NOT EXISTS idx_user_questions_is_key_query ON user_questions(is_key_query);
CREATE INDEX IF NOT EXISTS idx_user_questions_response_type ON user_questions(response_type);
CREATE INDEX IF NOT EXISTS idx_user_questions_no_results ON user_questions(shown_results_count) WHERE shown_results_count = 0;

-- Enable Row Level Security (optional - adjust as needed)
ALTER TABLE user_questions ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Service role has full access" ON user_questions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Useful analytics views

-- View: Daily question statistics
CREATE OR REPLACE VIEW daily_question_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_questions,
  COUNT(*) FILTER (WHERE query_language = 'ko') as korean_questions,
  COUNT(*) FILTER (WHERE query_language = 'en') as english_questions,
  COUNT(*) FILTER (WHERE is_key_query) as key_queries,
  COUNT(*) FILTER (WHERE shown_results_count = 0) as no_result_queries,
  COUNT(*) FILTER (WHERE used_claude_fallback) as claude_fallback_queries,
  ROUND(AVG(processing_time_ms)) as avg_processing_time_ms,
  ROUND(AVG(shown_results_count), 1) as avg_results_shown
FROM user_questions
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View: Top searched queries (last 30 days)
CREATE OR REPLACE VIEW top_queries_30d AS
SELECT
  LOWER(TRIM(user_query)) as query,
  COUNT(*) as search_count,
  ROUND(AVG(shown_results_count), 1) as avg_results,
  COUNT(*) FILTER (WHERE shown_results_count = 0) as no_result_count
FROM user_questions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY LOWER(TRIM(user_query))
HAVING COUNT(*) >= 2
ORDER BY search_count DESC
LIMIT 100;

-- View: Failed searches (queries with no results)
CREATE OR REPLACE VIEW failed_searches AS
SELECT
  user_query,
  query_language,
  clean_search_terms,
  is_key_query,
  requested_key,
  created_at
FROM user_questions
WHERE shown_results_count = 0
ORDER BY created_at DESC
LIMIT 500;

-- Function to get search analytics for a date range
CREATE OR REPLACE FUNCTION get_search_analytics(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_searches BIGINT,
  unique_queries BIGINT,
  success_rate NUMERIC,
  avg_results NUMERIC,
  korean_pct NUMERIC,
  key_query_pct NUMERIC,
  claude_fallback_pct NUMERIC,
  avg_processing_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_searches,
    COUNT(DISTINCT LOWER(TRIM(user_query)))::BIGINT as unique_queries,
    ROUND(100.0 * COUNT(*) FILTER (WHERE shown_results_count > 0) / NULLIF(COUNT(*), 0), 1) as success_rate,
    ROUND(AVG(shown_results_count), 1) as avg_results,
    ROUND(100.0 * COUNT(*) FILTER (WHERE query_language = 'ko') / NULLIF(COUNT(*), 0), 1) as korean_pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE is_key_query) / NULLIF(COUNT(*), 0), 1) as key_query_pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE used_claude_fallback) / NULLIF(COUNT(*), 0), 1) as claude_fallback_pct,
    ROUND(AVG(processing_time_ms), 0) as avg_processing_ms
  FROM user_questions
  WHERE created_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_questions IS 'Tracks all user search queries for analytics and improvement';
COMMENT ON VIEW daily_question_stats IS 'Daily aggregated statistics for user questions';
COMMENT ON VIEW top_queries_30d IS 'Most frequent search queries in the last 30 days';
COMMENT ON VIEW failed_searches IS 'Recent searches that returned no results';
