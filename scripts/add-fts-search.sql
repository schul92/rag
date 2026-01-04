-- Full-Text Search (BM25) Migration for PraiseFlow
-- Run this in Supabase SQL Editor
-- This enables PostgreSQL's built-in full-text search for better keyword matching

-- Add tsvector column for full-text search
ALTER TABLE song_images ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate the search vector with all searchable text
-- Uses 'simple' config to work with Korean text (no stemming)
UPDATE song_images SET search_vector =
  to_tsvector('simple',
    COALESCE(song_title, '') || ' ' ||
    COALESCE(song_title_korean, '') || ' ' ||
    COALESCE(song_title_english, '') || ' ' ||
    COALESCE(ocr_text, '')
  );

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_song_fts ON song_images USING gin(search_vector);

-- Create trigger to automatically update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_song_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    COALESCE(NEW.song_title, '') || ' ' ||
    COALESCE(NEW.song_title_korean, '') || ' ' ||
    COALESCE(NEW.song_title_english, '') || ' ' ||
    COALESCE(NEW.ocr_text, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS song_search_vector_trigger ON song_images;
CREATE TRIGGER song_search_vector_trigger
  BEFORE INSERT OR UPDATE ON song_images
  FOR EACH ROW EXECUTE FUNCTION update_song_search_vector();

-- Create BM25-style search function
-- Returns results ranked by relevance using ts_rank_cd
CREATE OR REPLACE FUNCTION search_bm25(
  query_text TEXT,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  song_title TEXT,
  song_title_korean TEXT,
  song_title_english TEXT,
  song_key TEXT,
  image_url TEXT,
  ocr_text TEXT,
  original_filename TEXT,
  song_group_id UUID,
  page_number INT,
  rank FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.id,
    s.song_title,
    s.song_title_korean,
    s.song_title_english,
    s.song_key,
    s.image_url,
    s.ocr_text,
    s.original_filename,
    s.song_group_id,
    s.page_number,
    ts_rank_cd(s.search_vector, plainto_tsquery('simple', query_text)) as rank
  FROM song_images s
  WHERE s.search_vector @@ plainto_tsquery('simple', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$;

-- Verify the setup
SELECT 'Full-Text Search setup complete!' as status;
SELECT COUNT(*) as songs_with_search_vector FROM song_images WHERE search_vector IS NOT NULL;
