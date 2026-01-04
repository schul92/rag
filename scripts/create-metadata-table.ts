/**
 * Create a new table for song metadata extracted by Claude Vision
 * This avoids needing to ALTER the existing table
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTable() {
  // Try to create the table by inserting a dummy record
  // The table will be auto-created if using Supabase's auto-schema feature
  // Otherwise, we'll create it via a different method

  console.log('Testing if song_metadata table exists...')

  const { data, error } = await supabase
    .from('song_metadata')
    .select('id')
    .limit(1)

  if (error && error.message.includes('does not exist')) {
    console.log('Table does not exist. Cannot create via API.')
    console.log('\nPlease run this SQL in Supabase SQL Editor:')
    console.log('---')
    console.log(`
CREATE TABLE IF NOT EXISTS song_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID REFERENCES song_images(id) ON DELETE CASCADE,
  song_title TEXT,
  song_title_korean TEXT,
  song_title_english TEXT,
  song_key TEXT,
  artist TEXT,
  lyrics_excerpt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(image_id)
);

CREATE INDEX IF NOT EXISTS song_metadata_title_idx ON song_metadata(song_title);
CREATE INDEX IF NOT EXISTS song_metadata_image_idx ON song_metadata(image_id);
    `)
  } else if (error) {
    console.log('Other error:', error.message)
  } else {
    console.log('Table already exists!')
  }
}

createTable()
