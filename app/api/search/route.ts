import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/openai'
import { redis, searchCacheKey, CACHE_TTL_SECONDS } from '@/lib/redis'
import { z } from 'zod'
import type { SearchResponse } from '@/lib/types'

// Validate incoming request body with Zod
// If query is missing or empty — return 400 immediately
const SearchSchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters'),
  threshold: z.number().min(0).max(1).default(0.3),
  limit: z.number().min(1).max(20).default(10),
})

export async function POST(req: NextRequest) {
  try {
    // 1. Parse + validate request body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body. Use valid JSON like { "query": "frontend jobs" }' },
        { status: 400 }
      )
    }
    
    const parsed = SearchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { query, threshold, limit } = parsed.data

    // 2. Check Redis cache first
    // If same query was searched before, return instantly
    const cacheKey = searchCacheKey(query)
    
    try {
      const cached = await redis.get<SearchResponse>(cacheKey)
    //   console.log('Redis cache key:', cacheKey, 'Cached length:', cached ? cached.jobs.length : 0)
      if (cached) {
        console.log(`Cache HIT for: "${query}"`)
        return NextResponse.json({ ...cached, cached: true })
      }
    } catch (cacheErr) {
      // If Redis is down, don't crash — just skip cache
      console.warn('Redis unavailable, skipping cache:', cacheErr)
    }

    console.log(`Cache MISS for: "${query}" — calling OpenAI...`)

    // 3. Convert search query to a vector using OpenAI
    // This is the ~200-500ms step — the main cost
    const queryEmbedding = await generateEmbedding(query)

    // 4. Run semantic search in Supabase using pgvector
    // match_jobs is the SQL function we created in Task 2
    const { data: jobs, error } = await supabase.rpc('match_jobs', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) {
      console.error('Supabase search error:', error)
      return NextResponse.json(
        { error: 'Search failed. Please try again.' },
        { status: 500 }
      )
    }

    // 5. Build the response object
    console.log(`Found ${jobs?.length ?? 0} jobs for: "${query}"`)
    console.log(jobs)
    const response: SearchResponse = {
      jobs: jobs ?? [],
      cached: false,
      query,
    }

    // 6. Store in Redis for next time (fire-and-forget)
    // We don't await this — no need to slow down the response
    redis.set(cacheKey, response, { ex: CACHE_TTL_SECONDS })
      .catch(err => console.warn('Failed to cache result:', err))

    return NextResponse.json(response)

  } catch (err) {
    console.error('Unexpected search error:', err)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}

// Reject non-POST requests with a clear message
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST with { query: string }' },
    { status: 405 }
  )
}