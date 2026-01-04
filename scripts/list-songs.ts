import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function listSongs() {
  const { data, error } = await supabase
    .from('song_images')
    .select('id, original_filename, ocr_text, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`\n📚 Total songs in database: ${data.length}\n`)
  console.log('─'.repeat(60))

  data.forEach((song, index) => {
    const title = song.ocr_text?.split('\n')[0]?.substring(0, 50) || song.original_filename
    console.log(`${index + 1}. ${title}`)
    console.log(`   File: ${song.original_filename}`)
    console.log('')
  })
}

listSongs()
