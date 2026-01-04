/**
 * Script to fix incorrect song keys in the database
 *
 * Run with: npx tsx scripts/fix-song-key.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixSongKey(searchTitle: string, newKey: string) {
  console.log(`\n🔍 Searching for songs matching: "${searchTitle}"`)

  // First, find the songs
  const { data: songs, error: findError } = await supabase
    .from('song_images')
    .select('id, song_title, song_key, original_filename')
    .ilike('song_title', `%${searchTitle}%`)

  if (findError) {
    console.error('❌ Error finding songs:', findError.message)
    return
  }

  if (!songs || songs.length === 0) {
    console.log('❌ No songs found matching the title')
    return
  }

  console.log(`\n📋 Found ${songs.length} matching songs:`)
  songs.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.song_title} (current key: ${s.song_key || 'none'})`)
    console.log(`     File: ${s.original_filename}`)
  })

  // Update the keys
  console.log(`\n🔧 Updating key to: "${newKey}"`)

  const { data: updated, error: updateError } = await supabase
    .from('song_images')
    .update({ song_key: newKey })
    .ilike('song_title', `%${searchTitle}%`)
    .select()

  if (updateError) {
    console.error('❌ Error updating songs:', updateError.message)
    return
  }

  console.log(`✅ Successfully updated ${updated?.length || 0} songs!`)
  updated?.forEach((s) => {
    console.log(`  - ${s.song_title} → key: ${s.song_key}`)
  })
}

// Check for duplicate entries
async function checkDuplicates(searchTitle: string) {
  console.log(`\n🔍 Checking duplicates for: "${searchTitle}"`)

  const { data: songs, error } = await supabase
    .from('song_images')
    .select('id, song_title, song_key, original_filename, image_url')
    .ilike('song_title', `%${searchTitle}%`)

  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  console.log(`\n📋 Found ${songs?.length || 0} entries:`)
  songs?.forEach((s, i) => {
    console.log(`  ${i + 1}. ID: ${s.id}`)
    console.log(`     Title: ${s.song_title}`)
    console.log(`     Key: ${s.song_key}`)
    console.log(`     File: ${s.original_filename}`)
    console.log(`     URL: ${s.image_url?.substring(0, 60)}...`)
    console.log('')
  })

  return songs
}

// Delete duplicate entries (keep the first one)
async function deleteDuplicates(ids: string[]) {
  if (ids.length === 0) return

  console.log(`\n🗑️  Deleting ${ids.length} duplicate entries...`)

  const { error } = await supabase
    .from('song_images')
    .delete()
    .in('id', ids)

  if (error) {
    console.error('❌ Error deleting:', error.message)
  } else {
    console.log('✅ Deleted successfully!')
  }
}

// Main execution
async function main() {
  // Check duplicates for 저 들 밖에 한밤중에
  const songs = await checkDuplicates('저 들 밖에')

  if (songs && songs.length > 1) {
    // Find entries with " 2" in filename (likely wrong page split)
    const duplicateIds = songs
      .filter(s => s.original_filename.includes(' 2.'))
      .map(s => s.id)

    if (duplicateIds.length > 0) {
      console.log(`\n⚠️  Found ${duplicateIds.length} likely duplicate(s) with ' 2' in filename`)
      await deleteDuplicates(duplicateIds)
    }
  }
}

main().catch(console.error)
