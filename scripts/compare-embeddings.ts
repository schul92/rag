/**
 * Compare voyage-3-large vs voyage-multilingual-2 embeddings
 * Run: npx tsx scripts/compare-embeddings.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'

interface VoyageResponse {
  data: Array<{ embedding: number[] }>
}

async function getEmbedding(text: string, model: string): Promise<number[]> {
  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: text }),
  })
  const data: VoyageResponse = await response.json()
  return data.data[0].embedding
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function compare() {
  const testCases = [
    { query: '주를 기뻐해', expected: '주를 기뻐해' },
    { query: 'holy forever', expected: 'Holy Forever' },
    { query: '감사합니다 주님', expected: '감사해요 주님의 보혈' },
    { query: '나는 믿어요', expected: '나는 믿네' },
    { query: 'goodness of god', expected: '주님의 선하심' },  // Cross-language
  ]

  console.log('Comparing voyage-3-large vs voyage-multilingual-2\n')
  console.log('=' .repeat(60))

  for (const test of testCases) {
    console.log(`\nQuery: "${test.query}" → Expected: "${test.expected}"`)

    // Get embeddings from both models
    const [queryV3, expectedV3] = await Promise.all([
      getEmbedding(test.query, 'voyage-3-large'),
      getEmbedding(test.expected, 'voyage-3-large'),
    ])

    const [queryMulti, expectedMulti] = await Promise.all([
      getEmbedding(test.query, 'voyage-multilingual-2'),
      getEmbedding(test.expected, 'voyage-multilingual-2'),
    ])

    const simV3 = cosineSimilarity(queryV3, expectedV3)
    const simMulti = cosineSimilarity(queryMulti, expectedMulti)

    const winner = simV3 > simMulti ? 'voyage-3-large' : 'voyage-multilingual-2'
    const diff = Math.abs(simV3 - simMulti) * 100

    console.log(`  voyage-3-large:       ${simV3.toFixed(4)}`)
    console.log(`  voyage-multilingual-2: ${simMulti.toFixed(4)}`)
    console.log(`  Winner: ${winner} (+${diff.toFixed(2)}%)`)

    await new Promise(r => setTimeout(r, 500)) // Rate limit
  }

  console.log('\n' + '='.repeat(60))
  console.log('Done!')
}

compare().catch(console.error)
