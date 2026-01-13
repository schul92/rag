-- Migrate embedding column from 512d to 1024d for voyage-3-large
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing embedding index (required before altering column)
DROP INDEX IF EXISTS song_images_embedding_idx;

-- Step 2: Alter the embedding column to 1024 dimensions
-- Note: This will keep existing data but embeddings need to be regenerated
ALTER TABLE song_images
ALTER COLUMN embedding TYPE vector(1024);

-- Step 3: Recreate the index for 1024d vectors
CREATE INDEX song_images_embedding_idx ON song_images
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 4: Update the search function to use 1024d
CREATE OR REPLACE FUNCTION search_songs_by_embedding(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  original_filename TEXT,
  ocr_text TEXT,
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
    si.song_key,
    1 - (si.embedding <=> query_embedding) AS similarity
  FROM song_images si
  WHERE si.embedding IS NOT NULL
    AND 1 - (si.embedding <=> query_embedding) > match_threshold
  ORDER BY si.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- After running this, you need to re-embed all songs with voyage-3-large
-- Run: pnpm tsx scripts/reembed-songs.ts
