-- Analytics V2 Migration: Scalable Aggregations
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite index for time-range queries on searches
CREATE INDEX IF NOT EXISTS idx_analytics_searches_created_normalized
  ON analytics_searches(created_at DESC, query_normalized);

-- Index for similarity score analysis
CREATE INDEX IF NOT EXISTS idx_analytics_searches_similarity
  ON analytics_searches(top_similarity_score DESC NULLS LAST)
  WHERE top_similarity_score IS NOT NULL;

-- Index for response time analysis
CREATE INDEX IF NOT EXISTS idx_analytics_searches_response_time
  ON analytics_searches(response_time_ms)
  WHERE response_time_ms IS NOT NULL;

-- =====================================================
-- 2. HOURLY AGGREGATIONS TABLE (for trends)
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_hourly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour_start TIMESTAMPTZ NOT NULL,
  total_searches INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_downloads INTEGER DEFAULT 0,
  zero_result_searches INTEGER DEFAULT 0,
  avg_response_time_ms NUMERIC(10,2),
  avg_similarity_score NUMERIC(5,4),
  google_fallback_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hour_start)
);

CREATE INDEX IF NOT EXISTS idx_hourly_stats_hour
  ON analytics_hourly_stats(hour_start DESC);

-- =====================================================
-- 3. FUNCTION: Aggregate hourly stats (run via cron)
-- =====================================================

CREATE OR REPLACE FUNCTION aggregate_hourly_stats(target_hour TIMESTAMPTZ DEFAULT NULL)
RETURNS void AS $$
DECLARE
  hour_start_ts TIMESTAMPTZ;
  hour_end_ts TIMESTAMPTZ;
BEGIN
  -- Default to previous hour if not specified
  IF target_hour IS NULL THEN
    hour_start_ts := date_trunc('hour', NOW() - INTERVAL '1 hour');
  ELSE
    hour_start_ts := date_trunc('hour', target_hour);
  END IF;
  hour_end_ts := hour_start_ts + INTERVAL '1 hour';

  INSERT INTO analytics_hourly_stats (
    hour_start,
    total_searches,
    total_sessions,
    total_clicks,
    total_downloads,
    zero_result_searches,
    avg_response_time_ms,
    avg_similarity_score,
    google_fallback_count
  )
  SELECT
    hour_start_ts,
    COALESCE((SELECT COUNT(*) FROM analytics_searches WHERE created_at >= hour_start_ts AND created_at < hour_end_ts), 0),
    COALESCE((SELECT COUNT(DISTINCT session_id) FROM analytics_searches WHERE created_at >= hour_start_ts AND created_at < hour_end_ts), 0),
    COALESCE((SELECT COUNT(*) FROM analytics_clicks WHERE created_at >= hour_start_ts AND created_at < hour_end_ts), 0),
    COALESCE((SELECT COUNT(*) FROM analytics_downloads WHERE created_at >= hour_start_ts AND created_at < hour_end_ts), 0),
    COALESCE((SELECT COUNT(*) FROM analytics_searches WHERE created_at >= hour_start_ts AND created_at < hour_end_ts AND is_zero_result = TRUE), 0),
    (SELECT AVG(response_time_ms) FROM analytics_searches WHERE created_at >= hour_start_ts AND created_at < hour_end_ts AND response_time_ms IS NOT NULL),
    (SELECT AVG(top_similarity_score) FROM analytics_searches WHERE created_at >= hour_start_ts AND created_at < hour_end_ts AND top_similarity_score IS NOT NULL),
    COALESCE((SELECT COUNT(*) FROM analytics_searches WHERE created_at >= hour_start_ts AND created_at < hour_end_ts AND is_google_fallback = TRUE), 0)
  ON CONFLICT (hour_start) DO UPDATE SET
    total_searches = EXCLUDED.total_searches,
    total_sessions = EXCLUDED.total_sessions,
    total_clicks = EXCLUDED.total_clicks,
    total_downloads = EXCLUDED.total_downloads,
    zero_result_searches = EXCLUDED.zero_result_searches,
    avg_response_time_ms = EXCLUDED.avg_response_time_ms,
    avg_similarity_score = EXCLUDED.avg_similarity_score,
    google_fallback_count = EXCLUDED.google_fallback_count,
    created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. FUNCTION: Get top searches (scalable with DB-side aggregation)
-- =====================================================

CREATE OR REPLACE FUNCTION get_top_searches(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  query TEXT,
  query_normalized TEXT,
  search_count BIGINT,
  zero_result_count BIGINT,
  avg_response_time_ms NUMERIC,
  avg_similarity_score NUMERIC,
  last_searched_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (array_agg(s.query ORDER BY s.created_at DESC))[1] as query,
    s.query_normalized,
    COUNT(*)::BIGINT as search_count,
    SUM(CASE WHEN s.is_zero_result THEN 1 ELSE 0 END)::BIGINT as zero_result_count,
    ROUND(AVG(s.response_time_ms)::NUMERIC, 2) as avg_response_time_ms,
    ROUND(AVG(s.top_similarity_score)::NUMERIC, 4) as avg_similarity_score,
    MAX(s.created_at) as last_searched_at
  FROM analytics_searches s
  WHERE s.created_at >= p_start_date
    AND s.created_at <= p_end_date
  GROUP BY s.query_normalized
  ORDER BY search_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. FUNCTION: Get failed searches (scalable)
-- =====================================================

CREATE OR REPLACE FUNCTION get_failed_searches(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 30
)
RETURNS TABLE (
  query TEXT,
  query_normalized TEXT,
  search_count BIGINT,
  unique_sessions BIGINT,
  last_searched_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (array_agg(s.query ORDER BY s.created_at DESC))[1] as query,
    s.query_normalized,
    COUNT(*)::BIGINT as search_count,
    COUNT(DISTINCT s.session_id)::BIGINT as unique_sessions,
    MAX(s.created_at) as last_searched_at
  FROM analytics_searches s
  WHERE s.created_at >= p_start_date
    AND s.created_at <= p_end_date
    AND s.is_zero_result = TRUE
  GROUP BY s.query_normalized
  ORDER BY search_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. FUNCTION: Get search logs with pagination
-- =====================================================

CREATE OR REPLACE FUNCTION get_search_logs(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_zero_result_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  session_id TEXT,
  query TEXT,
  language TEXT,
  result_count INTEGER,
  response_time_ms INTEGER,
  top_similarity_score NUMERIC,
  is_zero_result BOOLEAN,
  is_google_fallback BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.session_id,
    s.query,
    s.language,
    s.result_count,
    s.response_time_ms,
    s.top_similarity_score::NUMERIC,
    s.is_zero_result,
    s.is_google_fallback,
    s.created_at
  FROM analytics_searches s
  WHERE s.created_at >= p_start_date
    AND s.created_at <= p_end_date
    AND (NOT p_zero_result_only OR s.is_zero_result = TRUE)
  ORDER BY s.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. FUNCTION: Get daily trends for charts
-- =====================================================

CREATE OR REPLACE FUNCTION get_daily_trends(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  total_searches BIGINT,
  total_sessions BIGINT,
  total_clicks BIGINT,
  total_downloads BIGINT,
  zero_result_rate NUMERIC,
  avg_response_time_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      (CURRENT_DATE - (p_days - 1)),
      CURRENT_DATE,
      '1 day'::interval
    )::date as date
  ),
  daily_stats AS (
    SELECT
      s.created_at::date as search_date,
      COUNT(*) as searches,
      COUNT(DISTINCT s.session_id) as sessions,
      SUM(CASE WHEN s.is_zero_result THEN 1 ELSE 0 END) as zero_results,
      AVG(s.response_time_ms) as avg_response
    FROM analytics_searches s
    WHERE s.created_at >= (CURRENT_DATE - p_days)
    GROUP BY s.created_at::date
  ),
  daily_clicks AS (
    SELECT
      c.created_at::date as click_date,
      COUNT(*) as clicks
    FROM analytics_clicks c
    WHERE c.created_at >= (CURRENT_DATE - p_days)
    GROUP BY c.created_at::date
  ),
  daily_downloads AS (
    SELECT
      d.created_at::date as download_date,
      COUNT(*) as downloads
    FROM analytics_downloads d
    WHERE d.created_at >= (CURRENT_DATE - p_days)
    GROUP BY d.created_at::date
  )
  SELECT
    ds.date,
    COALESCE(st.searches, 0)::BIGINT as total_searches,
    COALESCE(st.sessions, 0)::BIGINT as total_sessions,
    COALESCE(dc.clicks, 0)::BIGINT as total_clicks,
    COALESCE(dd.downloads, 0)::BIGINT as total_downloads,
    CASE
      WHEN COALESCE(st.searches, 0) > 0
      THEN ROUND((COALESCE(st.zero_results, 0)::NUMERIC / st.searches * 100), 2)
      ELSE 0
    END as zero_result_rate,
    ROUND(COALESCE(st.avg_response, 0)::NUMERIC, 2) as avg_response_time_ms
  FROM date_series ds
  LEFT JOIN daily_stats st ON st.search_date = ds.date
  LEFT JOIN daily_clicks dc ON dc.click_date = ds.date
  LEFT JOIN daily_downloads dd ON dd.download_date = ds.date
  ORDER BY ds.date ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. FUNCTION: Get summary stats (optimized)
-- =====================================================

CREATE OR REPLACE FUNCTION get_analytics_summary(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_sessions BIGINT,
  total_searches BIGINT,
  total_clicks BIGINT,
  total_downloads BIGINT,
  zero_result_searches BIGINT,
  zero_result_rate NUMERIC,
  avg_response_time_ms NUMERIC,
  avg_similarity_score NUMERIC,
  google_fallback_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH search_stats AS (
    SELECT
      COUNT(DISTINCT session_id) as sessions,
      COUNT(*) as searches,
      SUM(CASE WHEN is_zero_result THEN 1 ELSE 0 END) as zero_results,
      AVG(response_time_ms) as avg_response,
      AVG(top_similarity_score) as avg_similarity,
      SUM(CASE WHEN is_google_fallback THEN 1 ELSE 0 END) as google_fallbacks
    FROM analytics_searches
    WHERE created_at >= p_start_date AND created_at <= p_end_date
  ),
  click_stats AS (
    SELECT COUNT(*) as clicks
    FROM analytics_clicks
    WHERE created_at >= p_start_date AND created_at <= p_end_date
  ),
  download_stats AS (
    SELECT COUNT(*) as downloads
    FROM analytics_downloads
    WHERE created_at >= p_start_date AND created_at <= p_end_date
  )
  SELECT
    COALESCE(ss.sessions, 0)::BIGINT,
    COALESCE(ss.searches, 0)::BIGINT,
    COALESCE(cs.clicks, 0)::BIGINT,
    COALESCE(ds.downloads, 0)::BIGINT,
    COALESCE(ss.zero_results, 0)::BIGINT,
    CASE
      WHEN COALESCE(ss.searches, 0) > 0
      THEN ROUND((COALESCE(ss.zero_results, 0)::NUMERIC / ss.searches * 100), 2)
      ELSE 0
    END,
    ROUND(COALESCE(ss.avg_response, 0)::NUMERIC, 2),
    ROUND(COALESCE(ss.avg_similarity, 0)::NUMERIC, 4),
    COALESCE(ss.google_fallbacks, 0)::BIGINT
  FROM search_stats ss
  CROSS JOIN click_stats cs
  CROSS JOIN download_stats ds;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. SCHEDULE HOURLY AGGREGATION (use pg_cron or Supabase Edge Functions)
-- =====================================================

-- If using pg_cron extension (must be enabled in Supabase):
-- SELECT cron.schedule('aggregate-hourly-stats', '5 * * * *', 'SELECT aggregate_hourly_stats()');

-- =====================================================
-- 10. BACKFILL HOURLY STATS (run once after migration)
-- =====================================================

-- Uncomment and run to backfill last 30 days:
-- DO $$
-- DECLARE
--   h TIMESTAMPTZ;
-- BEGIN
--   FOR h IN SELECT generate_series(
--     date_trunc('hour', NOW() - INTERVAL '30 days'),
--     date_trunc('hour', NOW()),
--     '1 hour'::interval
--   ) LOOP
--     PERFORM aggregate_hourly_stats(h);
--   END LOOP;
-- END $$;

-- =====================================================
-- DONE!
-- =====================================================
