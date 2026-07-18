import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { redis } from '@/lib/redis'
import { z } from 'zod'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const ExplainSchema = z.object({
  query: z.string().optional().default(''),
  job: z.object({
    title: z.string(),
    company: z.string(),
    location: z.string(),
    type: z.string(),
    description: z.string(),
    skills: z.array(z.string()),
    salary_min: z.number().nullable().optional(),
    salary_max: z.number().nullable().optional(),
    similarity: z.number().optional(),
  }),
})

const ExplainResponseSchema = z.object({
  summary: z.string().trim().min(1),
  matchScore: z.number().min(0).max(100),
  whyMatch: z.array(z.string().trim().min(1)),
  missingAreas: z.array(z.string().trim().min(1)),
  learningPlan: z.array(z.string().trim().min(1)),
  jobHighlights: z.array(z.string().trim().min(1)),
})

type ExplainResponse = z.infer<typeof ExplainResponseSchema>

function buildFallbackResponse(
  inferredScore: number,
  job: z.infer<typeof ExplainSchema>['job']
): ExplainResponse {
  return {
    summary: `This role is a ${inferredScore}% match based on job requirements, your profile context, and the skills listed in the description.`,
    matchScore: inferredScore,
    whyMatch: [
      `Core stack alignment with ${job.skills.slice(0, 3).join(', ') || 'the required skills'}.`,
      `Role context fits ${job.type} work style and ${job.location} preference signals.`,
    ],
    missingAreas: ['Some required tools or depth may need stronger evidence.', 'Competition may require portfolio-level examples.'],
    learningPlan: ['Strengthen one missing skill with a mini project.', 'Practice interview-ready examples mapped to this role.'],
    jobHighlights: [job.title, `${job.company} in ${job.location}`],
  }
}

function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1)
  }

  return text
}

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
  const normalizedQuery = query.trim()
  const effectiveQuery = normalizedQuery || 'resume profile'
  const inferredScore = job.similarity
    ? Math.max(0, Math.min(100, Math.round(job.similarity * 100)))
    : 60

  // Check Redis cache first — explanations are expensive
  // Cache key includes both job title + query so same job
  // searched with different queries gets different explanations
  const cacheKey = `explain:v2:${job.title}:${job.company}:${effectiveQuery}`
    .toLowerCase().replace(/\s+/g, '-').slice(0, 200)

  try {
    const cached = await redis.get<unknown>(cacheKey)
    if (cached) {
      if (typeof cached === 'string') {
        // Graceful read for old cache entries where explanation was plain text.
        const fallbackFromText = buildFallbackResponse(inferredScore, job)
        return Response.json({
          ...fallbackFromText,
          summary: cached.trim() || fallbackFromText.summary,
          cached: true,
        })
      }

      const parsedCached = ExplainResponseSchema.safeParse(cached)
      if (parsedCached.success) {
        return Response.json({ ...parsedCached.data, cached: true })
      }
    }
  } catch { /* skip cache on error */ }

  // Build a structured prompt so UI can show sections consistently.
  const salaryText = job.salary_min && job.salary_max
    ? `₹${(job.salary_min/100000).toFixed(0)}–${(job.salary_max/100000).toFixed(0)} LPA`
    : 'not disclosed'

  const prompt = `User context: "${effectiveQuery}"

Here is a job with an estimated match score of ${inferredScore}%:

Job Title: ${job.title}
Company: ${job.company}  
Location: ${job.location} (${job.type})
Salary: ${salaryText}
Skills required: ${job.skills.join(', ')}
Description: ${job.description}

Return ONLY valid JSON in this exact shape:
{
  "summary": "2-4 sentence explanation focused on the job description",
  "matchScore": ${inferredScore},
  "whyMatch": ["specific reason", "specific reason"],
  "missingAreas": ["specific gap", "specific gap"],
  "learningPlan": ["what to learn next", "what to learn next"],
  "jobHighlights": ["key highlight", "key highlight"]
}

Rules:
- Keep each array between 2 and 4 items.
- Be concrete, reference job description details.
- If data is missing, still provide best-effort concise output.`

  try {
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 650,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = extractTextContent(
      completion.content as Array<{ type: string; text?: string }>
    )

    const parsedJson = JSON.parse(extractJsonObject(rawText)) as unknown
    const validated = ExplainResponseSchema.safeParse(parsedJson)

    const fallback = buildFallbackResponse(inferredScore, job)

    const response = validated.success ? validated.data : fallback

    redis.set(cacheKey, response, { ex: 60 * 60 * 24 }).catch(() => {})

    return Response.json({ ...response, cached: false })
  } catch (err) {
    console.error('Explain generation error:', err)
    return Response.json(
      {
        summary: 'Unable to generate explanation right now. Please try again.',
        matchScore: inferredScore,
        whyMatch: [],
        missingAreas: [],
        learningPlan: [],
        jobHighlights: [],
        cached: false,
      },
      { status: 200 }
    )
  }
}