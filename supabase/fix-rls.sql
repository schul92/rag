-- Fix Supabase Security Linter Issues
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. Enable RLS on all public tables
-- =============================================

ALTER TABLE public.song_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyrics_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_key_selections ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. Policies for song_images (read-only for app)
-- =============================================

-- Allow anyone to read song images
CREATE POLICY "Allow public read access on song_images"
ON public.song_images FOR SELECT
TO anon, authenticated
USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role full access on song_images"
ON public.song_images FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- 3. Policies for lyrics_chunks (read-only for app)
-- =============================================

-- Allow anyone to read lyrics
CREATE POLICY "Allow public read access on lyrics_chunks"
ON public.lyrics_chunks FOR SELECT
TO anon, authenticated
USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role full access on lyrics_chunks"
ON public.lyrics_chunks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- 4. Policies for analytics tables (insert for app, read for service)
-- =============================================

-- analytics_sessions
CREATE POLICY "Allow public insert on analytics_sessions"
ON public.analytics_sessions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Service role full access on analytics_sessions"
ON public.analytics_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- analytics_searches
CREATE POLICY "Allow public insert on analytics_searches"
ON public.analytics_searches FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Service role full access on analytics_searches"
ON public.analytics_searches FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- analytics_clicks
CREATE POLICY "Allow public insert on analytics_clicks"
ON public.analytics_clicks FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Service role full access on analytics_clicks"
ON public.analytics_clicks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- analytics_downloads
CREATE POLICY "Allow public insert on analytics_downloads"
ON public.analytics_downloads FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Service role full access on analytics_downloads"
ON public.analytics_downloads FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- analytics_key_selections
CREATE POLICY "Allow public insert on analytics_key_selections"
ON public.analytics_key_selections FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Service role full access on analytics_key_selections"
ON public.analytics_key_selections FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- 5. Fix Security Definer Views
-- Replace with SECURITY INVOKER (default)
-- =============================================

-- Drop existing views
DROP VIEW IF EXISTS public.popular_songs_summary;
DROP VIEW IF EXISTS public.failed_searches_summary;
DROP VIEW IF EXISTS public.top_searches_summary;

-- Recreate popular_songs_summary (with correct column names and type cast)
CREATE VIEW public.popular_songs_summary AS
SELECT
  ac.song_id,
  si.original_filename,
  COUNT(*) as click_count,
  COUNT(DISTINCT ac.session_id) as unique_sessions
FROM public.analytics_clicks ac
LEFT JOIN public.song_images si ON ac.song_id = si.id::text
WHERE ac.created_at > NOW() - INTERVAL '30 days'
GROUP BY ac.song_id, si.original_filename
ORDER BY click_count DESC
LIMIT 50;

-- Recreate failed_searches_summary
CREATE VIEW public.failed_searches_summary AS
SELECT
  query,
  COUNT(*) as search_count,
  MAX(created_at) as last_searched
FROM public.analytics_searches
WHERE is_zero_result = true
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY query
ORDER BY search_count DESC
LIMIT 50;

-- Recreate top_searches_summary
CREATE VIEW public.top_searches_summary AS
SELECT
  query,
  COUNT(*) as search_count,
  AVG(result_count) as avg_results,
  MAX(created_at) as last_searched
FROM public.analytics_searches
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY query
ORDER BY search_count DESC
LIMIT 50;

-- Grant access to views
GRANT SELECT ON public.popular_songs_summary TO anon, authenticated, service_role;
GRANT SELECT ON public.failed_searches_summary TO anon, authenticated, service_role;
GRANT SELECT ON public.top_searches_summary TO anon, authenticated, service_role;
