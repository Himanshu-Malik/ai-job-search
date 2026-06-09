import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { redis } from '@/lib/redis'
import { z } from 'zod'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const ExplainSchema = z.object({
  query: z.string().min(2),
  job: z.object({
    title: z.string(),
    company: z.string(),
    location: z.string(),
    type: z.string(),
    description: z.string(),
    skills: z.array(z.string()),
    salary_min: z.number().optional(),
    salary_max: z.number().optional(),
    similarity: z.number().optional(),
  }),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = ExplainSchema.safeParse(body)

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400 }
    )
  }

  const { query, job } = parsed.data

  // Check Redis cache first — explanations are expensive
  // Cache key includes both job title + query so same job
  // searched with different queries gets different explanations
  const cacheKey = `explain:${job.title}:${job.company}:${query}`
    .toLowerCase().replace(/\s+/g, '-').slice(0, 200)

  try {
    const cached = await redis.get<string>(cacheKey)
    if (cached) {
      // Return cached explanation as a plain stream
      return new Response(cached, {
        headers: {
          'Content-Type': 'text/plain',
          'X-Cached': 'true',
        },
      })
    }
  } catch { /* skip cache on error */ }

  // Build the prompt — specific and structured gives better output
  const salaryText = job.salary_min && job.salary_max
    ? `₹${(job.salary_min/100000).toFixed(0)}–${(job.salary_max/100000).toFixed(0)} LPA`
    : 'not disclosed'

  const matchPct = job.similarity
    ? `${Math.round(job.similarity * 100)}%`
    : 'strong'

  const prompt = `A job seeker searched for: "${query}"

Here is a job that matched with a ${matchPct} similarity score:

Job Title: ${job.title}
Company: ${job.company}  
Location: ${job.location} (${job.type})
Salary: ${salaryText}
Skills required: ${job.skills.join(', ')}
Description: ${job.description}

In 3–4 concise sentences, explain specifically why this job matches what the person is looking for. 
Be direct and specific — mention actual skills, location preferences, and work style from their query.
End with one honest note about anything that might not perfectly align (if any).
Do not use bullet points. Write in a warm, helpful tone like a knowledgeable career advisor.`

  // Stream the response using ReadableStream
  // This is what makes words appear one by one in the UI
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        // Claude streaming API
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 250,
          messages: [{ role: 'user', content: prompt }],
        })

        // Each chunk is a few characters/words — send immediately
        for await (const chunk of claudeStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const text = chunk.delta.text
            fullText += text
            // Encode and send chunk to browser
            controller.enqueue(new TextEncoder().encode(text))
          }
        }

        // Cache the full explanation for 24 hours
        // Same query + job won't call Claude again
        redis.set(cacheKey, fullText, { ex: 60 * 60 * 24 })
          .catch(() => {}) // fire and forget

      } catch (err) {
        console.error('Claude stream error:', err)
        controller.enqueue(
          new TextEncoder().encode(
            'Unable to generate explanation. Please try again.'
          )
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Cached': 'false',
      // These headers enable streaming in the browser
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}