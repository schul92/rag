-- Add song aliases for cross-language search
-- Run this in Supabase SQL Editor

-- Create aliases table
CREATE TABLE IF NOT EXISTS song_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_title TEXT NOT NULL,  -- The canonical title in song_images
  alias TEXT NOT NULL,       -- Alternative name (Korean, English, romanized)
  language VARCHAR(10),      -- 'ko', 'en', 'romanized'
  alias_type VARCHAR(20),    -- 'official', 'common', 'translation'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_title, alias)
);

-- Create index for fast alias lookup
CREATE INDEX IF NOT EXISTS idx_song_aliases_alias ON song_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_song_aliases_title ON song_aliases(song_title);

-- Enable pg_trgm for fuzzy search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index on song_title for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_song_title_trgm ON song_images USING gin(song_title gin_trgm_ops);

-- Create trigram index on aliases
CREATE INDEX IF NOT EXISTS idx_aliases_trgm ON song_aliases USING gin(alias gin_trgm_ops);

-- Function to search with fuzzy matching
CREATE OR REPLACE FUNCTION search_songs_fuzzy(
  search_query TEXT,
  similarity_threshold FLOAT DEFAULT 0.3,
  max_results INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  original_filename TEXT,
  song_title TEXT,
  song_key TEXT,
  match_score FLOAT,
  match_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH fuzzy_matches AS (
    -- Direct title matches
    SELECT
      si.id,
      si.image_url,
      si.original_filename,
      si.song_title,
      si.song_key,
      similarity(si.song_title, search_query) as score,
      'title' as match_type
    FROM song_images si
    WHERE si.song_title IS NOT NULL
      AND similarity(si.song_title, search_query) > similarity_threshold

    UNION ALL

    -- Alias matches
    SELECT
      si.id,
      si.image_url,
      si.original_filename,
      si.song_title,
      si.song_key,
      similarity(sa.alias, search_query) as score,
      'alias' as match_type
    FROM song_aliases sa
    JOIN song_images si ON LOWER(TRIM(si.song_title)) = LOWER(TRIM(sa.song_title))
    WHERE similarity(sa.alias, search_query) > similarity_threshold
  )
  SELECT DISTINCT ON (fm.id)
    fm.id,
    fm.image_url,
    fm.original_filename,
    fm.song_title,
    fm.song_key,
    fm.score as match_score,
    fm.match_type
  FROM fuzzy_matches fm
  ORDER BY fm.id, fm.score DESC
  LIMIT max_results;
END;
$$;

-- Insert common song aliases
INSERT INTO song_aliases (song_title, alias, language, alias_type) VALUES
-- Holy Forever variations
('Holy Forever', '거룩 영원히', 'ko', 'translation'),
('Holy Forever', '홀리 포에버', 'ko', 'romanized'),
('Holy Forever', 'holy forever', 'en', 'official'),
('HOLY FOREVER', 'Holy Forever', 'en', 'common'),

-- Common worship songs
('위대하신 주', 'How Great Is Our God', 'en', 'translation'),
('위대하신 주', '위대하신주', 'ko', 'common'),
('위대하신 주', 'great is our god', 'en', 'common'),

('흰 눈 처럼', '흰눈처럼', 'ko', 'common'),
('흰 눈 처럼', 'Like White Snow', 'en', 'translation'),

('전능하신 나의 주 하나님은', '전능하신 나의 주', 'ko', 'common'),
('전능하신 나의 주 하나님은', 'Almighty God', 'en', 'translation')
ON CONFLICT (song_title, alias) DO NOTHING;

-- Verify
SELECT * FROM song_aliases ORDER BY song_title;
