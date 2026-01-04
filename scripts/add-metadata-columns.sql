-- Migration: Add song metadata columns extracted by Claude Vision
-- Run this in Supabase SQL Editor

-- Add song_title column for the clean extracted title
ALTER TABLE song_images ADD COLUMN IF NOT EXISTS song_title TEXT;

-- Add Korean title column
ALTER TABLE song_images ADD COLUMN IF NOT EXISTS song_title_korean TEXT;

-- Add English title column
ALTER TABLE song_images ADD COLUMN IF NOT EXISTS song_title_english TEXT;

-- Add artist column
ALTER TABLE song_images ADD COLUMN IF NOT EXISTS artist TEXT;

-- Add lyrics excerpt column
ALTER TABLE song_images ADD COLUMN IF NOT EXISTS lyrics_excerpt TEXT;

-- Create indexes for fast text search on titles
CREATE INDEX IF NOT EXISTS song_images_title_idx ON song_images(song_title);
CREATE INDEX IF NOT EXISTS song_images_title_korean_idx ON song_images(song_title_korean);
CREATE INDEX IF NOT EXISTS song_images_title_english_idx ON song_images(song_title_english);

-- Create a GIN index for full-text search on song_title
CREATE INDEX IF NOT EXISTS song_images_title_gin_idx ON song_images
USING gin(to_tsvector('simple', COALESCE(song_title, '')));

-- Update the search function to use clean metadata
CREATE OR REPLACE FUNCTION search_songs_by_embedding(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  song_id UUID,
  image_url TEXT,
  original_filename TEXT,
  ocr_text TEXT,
  song_title TEXT,
  song_key TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.song_id,
    si.image_url,
    si.original_filename,
    si.ocr_text,
    si.song_title,
    si.song_key,
    1 - (si.embedding <=> query_embedding) AS similarity
  FROM song_images si
  WHERE si.embedding IS NOT NULL
    AND 1 - (si.embedding <=> query_embedding) > match_threshold
  ORDER BY si.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Simple text search function on clean metadata
CREATE OR REPLACE FUNCTION search_songs_by_title(
  search_query TEXT,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  original_filename TEXT,
  song_title TEXT,
  song_title_korean TEXT,
  song_title_english TEXT,
  song_key TEXT,
  artist TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.image_url,
    si.original_filename,
    si.song_title,
    si.song_title_korean,
    si.song_title_english,
    si.song_key,
    si.artist
  FROM song_images si
  WHERE
    si.song_title ILIKE '%' || search_query || '%'
    OR si.song_title_korean ILIKE '%' || search_query || '%'
    OR si.song_title_english ILIKE '%' || search_query || '%'
  LIMIT match_count;
END;
$$;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'song_images'
ORDER BY ordinal_position;
