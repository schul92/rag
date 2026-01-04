import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyFiles() {
  // Get files matching the pattern
  const { data: files, error } = await supabase.storage
    .from('song-sheets')
    .list('', {
      search: '36b217859d21',
    })

  if (error) {
    console.error('Error listing files:', error)
    return
  }

  console.log('\n흰눈처럼 files in storage:\n')

  for (const file of files || []) {
    console.log(`File: ${file.name}`)
    console.log(`  Size: ${file.metadata?.size || 'N/A'} bytes`)
    console.log(`  Created: ${file.created_at}`)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('song-sheets')
      .getPublicUrl(file.name)

    console.log(`  URL: ${urlData.publicUrl}`)
    console.log('')
  }

  // Also fetch and compare actual file sizes via HTTP
  console.log('Verifying actual file content via HTTP:\n')

  const urls = [
    'https://gkplxjckzsvouxfmgxtc.supabase.co/storage/v1/object/public/song-sheets/TalkMedia_i_36b217859d21.jpeg',
    'https://gkplxjckzsvouxfmgxtc.supabase.co/storage/v1/object/public/song-sheets/TalkMedia_i_36b217859d21%202.jpeg',
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      const contentLength = response.headers.get('content-length')
      const contentType = response.headers.get('content-type')
      console.log(`URL: ${url}`)
      console.log(`  Status: ${response.status}`)
      console.log(`  Content-Length: ${contentLength}`)
      console.log(`  Content-Type: ${contentType}`)
      console.log('')
    } catch (err) {
      console.error(`Error fetching ${url}:`, err)
    }
  }
}

verifyFiles()
