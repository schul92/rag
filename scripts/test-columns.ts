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

async function tryUpdate() {
  const { data: sample } = await supabase.from('song_images').select('id').limit(1)

  if (!sample || !sample[0]) {
    console.log('No records found')
    return
  }

  const testId = sample[0].id
  console.log('Testing with ID:', testId)

  // Try to update with new column
  const { data, error } = await supabase
    .from('song_images')
    .update({ song_title: 'TEST' })
    .eq('id', testId)
    .select()

  if (error) {
    console.log('Error:', error.message)
    console.log('\nColumns do not exist yet.')
  } else {
    console.log('SUCCESS! Column exists. Reverting...')
    await supabase.from('song_images').update({ song_title: null }).eq('id', testId)
    console.log('Columns are ready!')
  }
}

tryUpdate()
