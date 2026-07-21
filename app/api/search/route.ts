import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/openai'
import { redis, CACHE_TTL_SECONDS } from '@/lib/redis'
import { z } from 'zod'
import type { SearchResponse } from '@/lib/types'

// Validate incoming request body with Zod
// If query is missing or empty — return 400 immediately
const SearchSchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters'),
  threshold: z.number().min(0).max(1).default(0.2),
  limit: z.number().min(1).max(200).default(24),
})

const ROLE_NOISE_WORDS = new Set([
  'engineer',
  'developer',
  'job',
  'jobs',
  'role',
  'position',
])

const QUERY_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'or',
  'for',
  'to',
  'in',
  'on',
  'at',
  'of',
  'with',
])

function normalizeSearchQuery(query: string): string {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return query

  // Common shorthand normalization helps semantic + fallback match quality.
  return trimmed
    .replace(/reactjs/g, 'react js')
    .replace(/nextjs/g, 'next js')
    .replace(/\bstrpe\b/g, 'stripe')
}

function canonicalSemanticQuery(normalizedQuery: string): string {
  const tokens = normalizedQuery
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length <= 1) return normalizedQuery

  const filtered = tokens.filter((token) => !ROLE_NOISE_WORDS.has(token))
  return filtered.length > 0 ? filtered.join(' ') : normalizedQuery
}

function extractIntentTokens(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/\s+/)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token))
    )
  )
}

function hasTokenMatch(text: string, token: string): boolean {
  return text.toLowerCase().includes(token)
}

function lexicalScoreForJob(job: SearchResponse['jobs'][number], tokens: string[]): number {
  if (tokens.length === 0) return 0

  const title = (job.title ?? '').toLowerCase()
  const company = (job.company ?? '').toLowerCase()
  const description = (job.description ?? '').toLowerCase()

  let score = 0
  for (const token of tokens) {
    if (hasTokenMatch(title, token)) score += 1.6
    if (hasTokenMatch(company, token)) score += 1.0
    if (hasTokenMatch(description, token)) score += 0.35
  }

  const phrase = tokens.join(' ')
  if (phrase.length > 2 && title.includes(phrase)) score += 1.4
  if (phrase.length > 2 && company.includes(phrase)) score += 0.8

  return score
}

function toSimilarity(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return 0
}

function freshnessScore(postedAt: string | undefined): number {
  if (!postedAt) return 0

  const posted = Date.parse(postedAt)
  if (!Number.isFinite(posted)) return 0

  const ageDays = Math.max(0, (Date.now() - posted) / (1000 * 60 * 60 * 24))
  if (ageDays <= 3) return 0.35
  if (ageDays <= 7) return 0.2
  if (ageDays <= 14) return 0.1
  return 0
}

function shouldPrioritizeIntent(tokens: string[]): boolean {
  if (tokens.length === 0 || tokens.length > 3) return false
  return tokens.every((token) => token.length >= 4)
}

function matchesIntentInTitleOrCompany(
  job: SearchResponse['jobs'][number],
  tokens: string[]
): boolean {
  if (tokens.length === 0) return false

  const title = (job.title ?? '').toLowerCase()
  const company = (job.company ?? '').toLowerCase()

  return tokens.some((token) => title.includes(token) || company.includes(token))
}

function rerankJobs(
  jobs: SearchResponse['jobs'],
  tokens: string[],
  limit: number
): SearchResponse['jobs'] {
  const ranked = [...jobs].sort((a, b) => {
    const aScore = lexicalScoreForJob(a, tokens) + (toSimilarity(a.similarity) * 2.3) + freshnessScore(a.posted_at)
    const bScore = lexicalScoreForJob(b, tokens) + (toSimilarity(b.similarity) * 2.3) + freshnessScore(b.posted_at)
    return bScore - aScore
  })

  if (!shouldPrioritizeIntent(tokens)) {
    return ranked.slice(0, limit)
  }

  const intentFirst: SearchResponse['jobs'] = []
  const intentLater: SearchResponse['jobs'] = []

  for (const job of ranked) {
    if (matchesIntentInTitleOrCompany(job, tokens)) {
      intentFirst.push(job)
    } else {
      intentLater.push(job)
    }
  }

  return [...intentFirst, ...intentLater].slice(0, limit)
}

async function runSemanticSearch(
  queryEmbedding: number[],
  threshold: number,
  limit: number
) {
  return supabase.rpc('match_jobs', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  })
}

function escapeLikeQuery(input: string): string {
  // Remove wildcard/control characters for safe ilike pattern.
  return input.replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function runKeywordFallbackSearch(
  normalizedQuery: string,
  limit: number
): Promise<SearchResponse['jobs']> {
  const safeKeyword = escapeLikeQuery(normalizedQuery)
  if (!safeKeyword) return []

  const tokens = safeKeyword
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)

  const searchTokens = tokens.length > 0 ? tokens : [safeKeyword]

  const orParts: string[] = []
  for (const token of searchTokens) {
    const pattern = `%${token}%`
    orParts.push(`title.ilike.${pattern}`)
    orParts.push(`company.ilike.${pattern}`)
    orParts.push(`description.ilike.${pattern}`)
  }

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('id,title,company,location,type,salary_min,salary_max,currency,experience,description,skills,apply_url,posted_at')
    .or(orParts.join(','))
    .order('posted_at', { ascending: false })
    .limit(Math.max(limit * 2, 20))

  if (error) {
    console.warn('Keyword fallback search failed:', error)
    return []
  }

  return (data as SearchResponse['jobs'] | null) ?? []
}

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
    const normalizedQuery = normalizeSearchQuery(query)
    const semanticQuery = canonicalSemanticQuery(normalizedQuery)

    // 2. Check Redis cache first
    // If same query was searched before, return instantly
    // Versioned key prevents stale empty caches from previous search logic.
    const cacheKey = `search:v6:${semanticQuery.toLowerCase().trim()}:l${limit}`
    
    try {
      const cached = await redis.get<SearchResponse>(cacheKey)
    //   console.log('Redis cache key:', cacheKey, 'Cached length:', cached ? cached.jobs.length : 0)
      if (cached) {
        console.log(`Cache HIT for: "${normalizedQuery}"`)
        return NextResponse.json({ ...cached, cached: true })
      }
    } catch (cacheErr) {
      // If Redis is down, don't crash — just skip cache
      console.warn('Redis unavailable, skipping cache:', cacheErr)
    }

    console.log(`Cache MISS for: "${semanticQuery}" — calling OpenAI...`)

    const expandedLimit = Math.max(limit * 3, 36)
    const keywordFallbackPromise = runKeywordFallbackSearch(normalizedQuery, expandedLimit)

    // 3. Convert search query to a vector using OpenAI
    // This is the ~200-500ms step — the main cost
    const queryEmbedding = await generateEmbedding(semanticQuery)

    // 4. Adaptive semantic search fallback to improve recall.
    const candidateThresholds = Array.from(new Set([
      threshold,
      Math.max(0.15, threshold - 0.05),
      Math.max(0.1, threshold - 0.1),
      0,
    ]))

    let jobs: SearchResponse['jobs'] | null = null
    let error: unknown = null

    for (const candidateThreshold of candidateThresholds) {
      const result = await runSemanticSearch(queryEmbedding, candidateThreshold, expandedLimit)
      jobs = (result.data as SearchResponse['jobs'] | null) ?? []
      error = result.error

      if (error) {
        break
      }

      if ((jobs?.length ?? 0) >= Math.min(12, limit)) {
        break
      }
    }

    if (error) {
      console.error('Supabase search error:', error)
      return NextResponse.json(
        { error: 'Search failed. Please try again.' },
        { status: 500 }
      )
    }

    // 5. Build the response object
    console.log(`Found ${jobs?.length ?? 0} jobs for: "${normalizedQuery}"`)
    console.log(jobs)
    const semanticJobs = (jobs ?? []).slice(0, expandedLimit)
    const fallbackJobs = await keywordFallbackPromise
    const intentTokens = extractIntentTokens(semanticQuery)
    const mergedById = new Map<string, SearchResponse['jobs'][number]>()

    for (const job of semanticJobs) {
      mergedById.set(job.id, job)
    }
    for (const job of fallbackJobs) {
      const existing = mergedById.get(job.id)
      // Keep similarity data from semantic result when available.
      mergedById.set(job.id, existing ? { ...job, similarity: existing.similarity } : job)
    }

    const finalJobs = rerankJobs([...mergedById.values()], intentTokens, limit)

    const response: SearchResponse = {
      jobs: finalJobs,
      cached: false,
      query: semanticQuery,
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