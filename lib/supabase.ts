import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key for admin operations
export function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey)
}

export interface Song {
  id: string
  title: string
  title_korean?: string
  title_english?: string
  key?: string
  youtube_url?: string
  lyrics?: string
  created_at: string
}

export interface SongImage {
  id: string
  song_id?: string
  image_url: string
  original_filename: string
  ocr_text?: string
  embedding?: number[]
  created_at: string
}
