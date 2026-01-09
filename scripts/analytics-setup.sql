-- Analytics System Setup for Supabase
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. ANALYTICS SESSIONS TABLE
-- Tracks anonymous user sessions
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  device_type TEXT,  -- 'mobile', 'tablet', 'desktop'
  language TEXT,     -- 'ko' or 'en'
  total_searches INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_downloads INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last_active
  ON analytics_sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_created
  ON analytics_sessions(created_at);

-- =====================================================
-- 2. ANALYTICS SEARCHES TABLE
-- Tracks every search query
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  query TEXT NOT NULL,
  query_normalized TEXT NOT NULL,  -- Lowercase, trimmed for dedup
  language TEXT NOT NULL DEFAULT 'ko',
  result_count INTEGER NOT NULL DEFAULT 0,
  response_time_ms INTEGER,
  search_type TEXT,  -- 'title', 'key_list', 'lyrics', 'google_fallback'
  result_song_ids TEXT[],  -- Array of song IDs returned
  requested_key TEXT,  -- If user searched for specific key
  is_zero_result BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_searches_session
  ON analytics_searches(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_searches_query
  ON analytics_searches(query_normalized);
CREATE INDEX IF NOT EXISTS idx_analytics_searches_created
  ON analytics_searches(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_searches_zero_result
  ON analytics_searches(is_zero_result) WHERE is_zero_result = TRUE;

-- =====================================================
-- 3. ANALYTICS CLICKS TABLE
-- Tracks when users click on search results
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  search_id UUID REFERENCES analytics_searches(id) ON DELETE SET NULL,
  song_id TEXT NOT NULL,
  click_position INTEGER,  -- Position in results (1-indexed)
  click_type TEXT NOT NULL DEFAULT 'view',  -- 'view', 'expand'
  view_duration_ms INTEGER,  -- How long dialog was open
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_clicks_session
  ON analytics_clicks(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_clicks_song
  ON analytics_clicks(song_id);
CREATE INDEX IF NOT EXISTS idx_analytics_clicks_created
  ON analytics_clicks(created_at);

-- =====================================================
-- 4. ANALYTICS DOWNLOADS TABLE
-- Tracks when users download chord sheets
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  click_id UUID REFERENCES analytics_clicks(id) ON DELETE SET NULL,
  song_id TEXT NOT NULL,
  download_type TEXT NOT NULL DEFAULT 'single_page',  -- 'single_page', 'all_pages', 'share'
  page_count INTEGER DEFAULT 1,
  song_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_downloads_song
  ON analytics_downloads(song_id);
CREATE INDEX IF NOT EXISTS idx_analytics_downloads_created
  ON analytics_downloads(created_at);

-- =====================================================
-- 5. ANALYTICS KEY SELECTIONS TABLE
-- Tracks when users select a specific key
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_key_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  search_id UUID REFERENCES analytics_searches(id) ON DELETE SET NULL,
  song_id TEXT,
  selected_key TEXT NOT NULL,
  available_keys TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_key_selections_key
  ON analytics_key_selections(selected_key);
CREATE INDEX IF NOT EXISTS idx_analytics_key_selections_created
  ON analytics_key_selections(created_at);

-- =====================================================
-- 6. SONG POPULARITY MATERIALIZED VIEW
-- Aggregated popularity scores for search ranking boost
-- =====================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS song_popularity AS
SELECT
  ac.song_id,
  COUNT(DISTINCT ac.session_id) as unique_viewers,
  COUNT(ac.id) as total_views,
  COALESCE(dl.download_count, 0) as total_downloads,
  -- Weighted popularity score: views + downloads*3
  (COUNT(DISTINCT ac.session_id) + COALESCE(dl.download_count, 0) * 3.0) as popularity_score,
  -- Recent popularity (last 30 days)
  COUNT(DISTINCT CASE
    WHEN ac.created_at > NOW() - INTERVAL '30 days'
    THEN ac.session_id
  END) as recent_viewers,
  NOW() as last_updated
FROM analytics_clicks ac
LEFT JOIN (
  SELECT song_id, COUNT(*) as download_count
  FROM analytics_downloads
  GROUP BY song_id
) dl ON dl.song_id = ac.song_id
GROUP BY ac.song_id, dl.download_count;

CREATE UNIQUE INDEX IF NOT EXISTS idx_song_popularity_id
  ON song_popularity(song_id);

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function to increment session search count
CREATE OR REPLACE FUNCTION increment_session_searches(p_session_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE analytics_sessions
  SET
    total_searches = total_searches + 1,
    last_active_at = NOW()
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment session click count
CREATE OR REPLACE FUNCTION increment_session_clicks(p_session_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE analytics_sessions
  SET
    total_clicks = total_clicks + 1,
    last_active_at = NOW()
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment session download count
CREATE OR REPLACE FUNCTION increment_session_downloads(p_session_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE analytics_sessions
  SET
    total_downloads = total_downloads + 1,
    last_active_at = NOW()
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh popularity scores (call via cron or manually)
CREATE OR REPLACE FUNCTION refresh_song_popularity()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY song_popularity;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. ANALYTICS VIEWS FOR DASHBOARD
-- =====================================================

-- View for failed searches (zero results)
CREATE OR REPLACE VIEW failed_searches_summary AS
SELECT
  query_normalized as query,
  COUNT(*) as search_count,
  COUNT(DISTINCT session_id) as unique_sessions,
  MAX(created_at) as last_searched,
  MIN(created_at) as first_searched
FROM analytics_searches
WHERE is_zero_result = TRUE
GROUP BY query_normalized
HAVING COUNT(*) >= 2
ORDER BY search_count DESC;

-- View for top searches
CREATE OR REPLACE VIEW top_searches_summary AS
SELECT
  query_normalized as query,
  COUNT(*) as search_count,
  COUNT(DISTINCT session_id) as unique_sessions,
  AVG(result_count) as avg_results,
  AVG(response_time_ms) as avg_response_time_ms
FROM analytics_searches
GROUP BY query_normalized
ORDER BY search_count DESC;

-- View for popular songs
CREATE OR REPLACE VIEW popular_songs_summary AS
SELECT
  ac.song_id,
  si.song_title,
  si.song_key,
  COUNT(DISTINCT ac.session_id) as unique_viewers,
  COUNT(ac.id) as total_clicks,
  COALESCE(dl.download_count, 0) as total_downloads
FROM analytics_clicks ac
LEFT JOIN song_images si ON si.id::text = ac.song_id
LEFT JOIN (
  SELECT song_id, COUNT(*) as download_count
  FROM analytics_downloads
  GROUP BY song_id
) dl ON dl.song_id = ac.song_id
GROUP BY ac.song_id, si.song_title, si.song_key, dl.download_count
ORDER BY total_clicks DESC;

-- =====================================================
-- 9. ENABLE ROW LEVEL SECURITY (Optional)
-- =====================================================
-- Note: Since these are analytics tables accessed via service role key,
-- RLS is not strictly needed. But enable if you want extra security.

-- ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analytics_searches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analytics_clicks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analytics_downloads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analytics_key_selections ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DONE! Run refresh_song_popularity() periodically
-- e.g., via Supabase scheduled functions or cron
-- =====================================================
