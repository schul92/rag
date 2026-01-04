/**
 * Run Full-Text Search Migration
 *
 * This script adds the search_vector column and creates the BM25 search function.
 * Run with: pnpm tsx scripts/run-fts-migration.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('🔄 Running FTS Migration...\n')

  // Step 1: Check connection
  console.log('1. Checking database connection...')
  const { count, error: countError } = await supabase
    .from('song_images')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ Connection error:', countError.message)
    return
  }
  console.log(`   ✅ Connected! Found ${count} songs in database.\n`)

  // Step 2: Check if search_vector column exists
  console.log('2. Checking if search_vector column exists...')
  const { data: sampleData, error: sampleError } = await supabase
    .from('song_images')
    .select('id')
    .limit(1)

  // Try to query with search_vector to see if it exists
  const { error: vectorCheckError } = await supabase
    .rpc('search_bm25', { query_text: 'test', match_count: 1 })

  if (vectorCheckError) {
    if (vectorCheckError.message.includes('function') || vectorCheckError.message.includes('does not exist')) {
      console.log('   ❌ BM25 search function not found.')
      console.log('\n📋 The FTS migration needs to be run manually in Supabase SQL Editor.')
      console.log('\n   Steps:')
      console.log('   1. Go to https://supabase.com/dashboard/project/gkplxjckzsvouxfmgxtc')
      console.log('   2. Click "SQL Editor" in the left sidebar')
      console.log('   3. Click "New Query"')
      console.log('   4. Copy and paste the contents of: scripts/add-fts-search.sql')
      console.log('   5. Click "Run"')
      console.log('\n   The SQL file location:')
      console.log('   ' + path.resolve(__dirname, 'add-fts-search.sql'))
    } else {
      console.log('   Error:', vectorCheckError.message)
    }
  } else {
    console.log('   ✅ BM25 search function already exists!')

    // Test the function
    console.log('\n3. Testing BM25 search...')
    const { data: testResults, error: testError } = await supabase
      .rpc('search_bm25', { query_text: 'holy', match_count: 3 })

    if (testError) {
      console.log('   ⚠️  Test failed:', testError.message)
    } else {
      console.log(`   ✅ BM25 search works! Found ${testResults?.length || 0} results for "holy"`)
      if (testResults && testResults.length > 0) {
        testResults.forEach((r: any, i: number) => {
          console.log(`      ${i + 1}. ${r.song_title} (rank: ${r.rank?.toFixed(4)})`)
        })
      }
    }
  }

  console.log('\n✅ Migration check complete!')
}

runMigration().catch(console.error)
