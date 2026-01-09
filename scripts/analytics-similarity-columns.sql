-- Add similarity tracking columns to analytics_searches
-- Run this in Supabase SQL Editor

-- Add new columns for similarity tracking
ALTER TABLE analytics_searches
ADD COLUMN IF NOT EXISTS top_similarity_score FLOAT,
ADD COLUMN IF NOT EXISTS avg_similarity_score FLOAT,
ADD COLUMN IF NOT EXISTS is_google_fallback BOOLEAN DEFAULT FALSE;

-- Add index for querying Google fallback searches
CREATE INDEX IF NOT EXISTS idx_analytics_searches_google_fallback
ON analytics_searches(is_google_fallback)
WHERE is_google_fallback = TRUE;

-- Add index for low similarity searches (for quality monitoring)
CREATE INDEX IF NOT EXISTS idx_analytics_searches_low_similarity
ON analytics_searches(top_similarity_score)
WHERE top_similarity_score IS NOT NULL AND top_similarity_score < 0.5;

-- Comment: View to see searches with low similarity (potential quality issues)
-- SELECT query, top_similarity_score, avg_similarity_score, result_count, is_google_fallback
-- FROM analytics_searches
-- WHERE top_similarity_score IS NOT NULL
-- ORDER BY top_similarity_score ASC
-- LIMIT 50;
