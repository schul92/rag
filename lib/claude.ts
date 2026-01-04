import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function extractSongInfoFromImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<{
  title: string
  title_korean?: string
  title_english?: string
  key?: string
  ocr_text: string
}> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `This is a chord/lyric sheet for a worship song. Please extract the following information in JSON format:
{
  "title": "The main title of the song (could be Korean or English)",
  "title_korean": "Korean title if present",
  "title_english": "English title if present",
  "key": "Musical key if shown (e.g., G, A, C, etc.)",
  "ocr_text": "All readable text from the image including lyrics and chords"
}

Return ONLY the JSON, no other text.`,
          },
        ],
      },
    ],
  })

  const textContent = response.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  try {
    return JSON.parse(textContent.text)
  } catch {
    // If JSON parsing fails, try to extract useful info
    return {
      title: 'Unknown',
      ocr_text: textContent.text,
    }
  }
}

export async function generateChatResponse(
  query: string,
  searchResults: Array<{ title: string; image_url: string; ocr_text?: string }>
): Promise<string> {
  const resultsContext = searchResults.length > 0
    ? searchResults.map((r, i) => `${i + 1}. "${r.title}"`).join('\n')
    : 'No matching songs found.'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are a helpful assistant for a praise worship team. A user is looking for song chord sheets.

User query: "${query}"

Search results:
${resultsContext}

Respond in a friendly, helpful way. If songs were found, mention them. If no songs were found, suggest they try different keywords. Keep the response concise (1-2 sentences). Respond in the same language as the user's query (Korean or English).`,
      },
    ],
  })

  const textContent = response.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    return 'Sorry, I encountered an error processing your request.'
  }

  return textContent.text
}

export { anthropic }
