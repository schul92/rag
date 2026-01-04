-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Songs table (metadata extracted from chat)
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_korean TEXT,
  title_english TEXT,
  key TEXT,
  youtube_url TEXT,
  lyrics TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Song images table (chord sheets)
CREATE TABLE IF NOT EXISTS song_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  original_filename TEXT,
  ocr_text TEXT,
  song_key TEXT,  -- Musical key (e.g., G, A, C, Dm, etc.)
  embedding VECTOR(1024),  -- Voyage AI voyage-3-lite uses 1024 dimensions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add key column to existing table (run this if table already exists)
-- ALTER TABLE song_images ADD COLUMN IF NOT EXISTS song_key TEXT;

-- Migration: Add song_group_id for multi-page sheet music linking
-- ALTER TABLE song_images ADD COLUMN IF NOT EXISTS song_group_id TEXT;
-- CREATE INDEX IF NOT EXISTS song_images_group_idx ON song_images(song_group_id);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS song_images_embedding_idx ON song_images
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for text search
CREATE INDEX IF NOT EXISTS song_images_ocr_text_idx ON song_images
USING gin(to_tsvector('simple', ocr_text));

CREATE INDEX IF NOT EXISTS songs_title_idx ON songs
USING gin(to_tsvector('simple', title));

-- Function to search songs by vector similarity
CREATE OR REPLACE FUNCTION search_songs_by_embedding(
  query_embedding VECTOR(1024),  -- Voyage AI voyage-3-lite uses 1024 dimensions
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  song_id UUID,
  image_url TEXT,
  original_filename TEXT,
  ocr_text TEXT,
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
    1 - (si.embedding <=> query_embedding) AS similarity
  FROM song_images si
  WHERE si.embedding IS NOT NULL
    AND 1 - (si.embedding <=> query_embedding) > match_threshold
  ORDER BY si.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search songs by text (simple keyword search)
CREATE OR REPLACE FUNCTION search_songs_by_text(
  search_query TEXT,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  song_id UUID,
  image_url TEXT,
  original_filename TEXT,
  ocr_text TEXT,
  title TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (si.id)
    si.id,
    si.song_id,
    si.image_url,
    si.original_filename,
    si.ocr_text,
    COALESCE(s.title, '') AS title
  FROM song_images si
  LEFT JOIN songs s ON si.song_id = s.id
  WHERE
    si.ocr_text ILIKE '%' || search_query || '%'
    OR s.title ILIKE '%' || search_query || '%'
    OR s.title_korean ILIKE '%' || search_query || '%'
    OR s.title_english ILIKE '%' || search_query || '%'
  LIMIT match_count;
END;
$$;
