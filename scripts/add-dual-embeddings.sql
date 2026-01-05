-- Phase 2: Dual Embeddings Schema
-- Add voyage-3-large (2048d) and voyage-multilingual-2 (1024d) columns

-- Add new embedding columns
ALTER TABLE song_images ADD COLUMN IF NOT EXISTS embedding_large VECTOR(2048);
ALTER TABLE song_images ADD COLUMN IF NOT EXISTS embedding_multilingual VECTOR(1024);

-- Create indexes for fast vector search
CREATE INDEX IF NOT EXISTS song_images_embedding_large_idx
ON song_images USING ivfflat (embedding_large vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS song_images_embedding_multilingual_idx
ON song_images USING ivfflat (embedding_multilingual vector_cosine_ops)
WITH (lists = 100);

-- Create search functions for dual embeddings

-- Search using voyage-3-large (general search)
CREATE OR REPLACE FUNCTION search_songs_by_embedding_large(
  query_embedding VECTOR(2048),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  original_filename TEXT,
  ocr_text TEXT,
  song_title TEXT,
  song_title_korean TEXT,
  song_title_english TEXT,
  song_key TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.image_url,
    si.original_filename,
    si.ocr_text,
    si.song_title,
    si.song_title_korean,
    si.song_title_english,
    si.song_key,
    1 - (si.embedding_large <=> query_embedding) AS similarity
  FROM song_images si
  WHERE si.embedding_large IS NOT NULL
    AND 1 - (si.embedding_large <=> query_embedding) > match_threshold
  ORDER BY si.embedding_large <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Search using voyage-multilingual-2 (Korean-optimized)
CREATE OR REPLACE FUNCTION search_songs_by_embedding_multilingual(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  original_filename TEXT,
  ocr_text TEXT,
  song_title TEXT,
  song_title_korean TEXT,
  song_title_english TEXT,
  song_key TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.image_url,
    si.original_filename,
    si.ocr_text,
    si.song_title,
    si.song_title_korean,
    si.song_title_english,
    si.song_key,
    1 - (si.embedding_multilingual <=> query_embedding) AS similarity
  FROM song_images si
  WHERE si.embedding_multilingual IS NOT NULL
    AND 1 - (si.embedding_multilingual <=> query_embedding) > match_threshold
  ORDER BY si.embedding_multilingual <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Phase 3: Lyrics Chunks Table
CREATE TABLE IF NOT EXISTS lyrics_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_image_id UUID REFERENCES song_images(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_order INT NOT NULL,
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lyrics chunk search
CREATE INDEX IF NOT EXISTS lyrics_chunks_embedding_idx
ON lyrics_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for song_image_id lookup
CREATE INDEX IF NOT EXISTS lyrics_chunks_song_image_id_idx
ON lyrics_chunks (song_image_id);

-- Search function for lyrics chunks
CREATE OR REPLACE FUNCTION search_lyrics_chunks(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  chunk_id UUID,
  song_image_id UUID,
  chunk_text TEXT,
  chunk_order INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id AS chunk_id,
    lc.song_image_id,
    lc.chunk_text,
    lc.chunk_order,
    1 - (lc.embedding <=> query_embedding) AS similarity
  FROM lyrics_chunks lc
  WHERE lc.embedding IS NOT NULL
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
