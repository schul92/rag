import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUrls() {
  const { data, error } = await supabase
    .from('song_images')
    .select('id, original_filename, image_url')
    .ilike('original_filename', '%36b217859d21%')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('\n흰눈처럼 files in database:\n')
  data.forEach((row, i) => {
    console.log(`${i + 1}. ID: ${row.id}`)
    console.log(`   Filename: ${row.original_filename}`)
    console.log(`   URL: ${row.image_url}`)
    console.log('')
  })

  // Check if URLs are the same
  if (data.length >= 2) {
    console.log('Are URLs the same?', data[0].image_url === data[1].image_url ? 'YES - BUG!' : 'NO - Different')
  }
}

checkUrls()
