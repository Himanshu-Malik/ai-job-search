// scripts/real-time-data.ts

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'
import { pathToFileURL } from 'node:url'
import ws from 'ws'

dotenv.config({ path: '.env.development' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    realtime: { transport: ws as unknown as typeof WebSocket },
  }
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY

const SEARCH_QUERIES = [
  'react developer',
  'frontend engineer',
  'next js developer',
  'full stack developer react',
  'senior frontend engineer',
  'typescript developer',
]

const DEFAULT_GREENHOUSE_BOARDS = [
  'atlassian',
  'stripe',
  'notion',
  'airtable',
  'canva',
  'coinbase',
  'duolingo',
]

const GREENHOUSE_BOARDS =
  process.env.GREENHOUSE_BOARDS
    ?.split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean) ?? DEFAULT_GREENHOUSE_BOARDS

const MAX_JOB_AGE_DAYS = Number(process.env.JOB_MAX_AGE_DAYS ?? 30)
const PRUNE_JOB_AGE_DAYS = Number(process.env.JOB_PRUNE_AGE_DAYS ?? 45)
const ADZUNA_RESULTS_PER_QUERY = Number(process.env.ADZUNA_RESULTS_PER_QUERY ?? 20)
const ADZUNA_PAGES = Number(process.env.ADZUNA_PAGES ?? 2)
const EXTERNAL_FETCH_TIMEOUT_MS = Number(process.env.EXTERNAL_FETCH_TIMEOUT_MS ?? 15000)
const EXTERNAL_FETCH_RETRIES = Number(process.env.EXTERNAL_FETCH_RETRIES ?? 3)

const SKILL_KEYWORDS = [
  'React',
  'Next.js',
  'TypeScript',
  'JavaScript',
  'Redux',
  'Node.js',
  'GraphQL',
  'AWS',
  'Docker',
  'MongoDB',
  'PostgreSQL',
  'Redis',
  'Tailwind',
  'Vue',
  'Angular',
  'Webpack',
  'Jest',
  'CSS',
  'HTML',
]

type JobType = 'remote' | 'hybrid' | 'onsite'

export type SyncSource = 'adzuna' | 'greenhouse'

type AdzunaJob = {
  id: string | number
  title: string
  description?: string
  redirect_url?: string
  salary_min?: number | null
  salary_max?: number | null
  created?: string
  company?: { display_name?: string }
  location?: { display_name?: string }
}

type GreenhouseBoardJobsResponse = {
  jobs: GreenhouseJob[]
}

type GreenhouseJob = {
  id: number
  title: string
  updated_at?: string
  absolute_url: string
  content?: string
  location?: {
    name?: string
  }
  offices?: Array<{
    name?: string
    location?: {
      name?: string
    }
  }>
  metadata?: Array<{
    name?: string
    value?: string
  }>
}

type JobsTableRow = {
  id: string
  external_id: string | null
  title: string
  company: string
  location: string
  type: JobType
  description: string
  apply_url: string
  posted_at: string
  skills: string[]
}

type JobInsert = {
  title: string
  company: string
  location: string
  type: JobType
  salary_min: number | null
  salary_max: number | null
  currency: string
  description: string
  skills: string[]
  apply_url: string
  source: SyncSource
  external_id: string
  posted_at: string
}

type SyncStats = {
  inserted: number
  updated: number
  skipped: number
  pruned: number
  fetched: number
  sourceBreakdown: Record<SyncSource, number>
  errors: string[]
}

type SyncOptions = {
  sources?: SyncSource[]
  includePrune?: boolean
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase()
  return SKILL_KEYWORDS.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 8)
}

function inferType(text: string): JobType {
  const lower = text.toLowerCase()
  if (lower.includes('hybrid')) return 'hybrid'
  if (lower.includes('remote') || lower.includes('work from home')) return 'remote'
  return 'onsite'
}

function sanitizeText(value: string | undefined | null, limit = 2400): string {
  if (!value) return ''
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function isFreshDate(isoDate: string, maxAgeDays: number): boolean {
  const ts = Date.parse(isoDate)
  if (Number.isNaN(ts)) return true
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
  return Date.now() - ts <= maxAgeMs
}

function toExternalId(source: SyncSource, id: string | number): string {
  return `${source}:${String(id)}`
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= EXTERNAL_FETCH_RETRIES; attempt += 1) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) })
    } catch (error) {
      lastError = error

      if (attempt < EXTERNAL_FETCH_RETRIES) {
        await wait(300 * attempt)
      }
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : 'External fetch failed after retries'
  throw new Error(message)
}

function adzunaToJobInsert(raw: AdzunaJob): JobInsert | null {
  const description = sanitizeText(raw.description)
  const title = raw.title?.trim()
  const applyUrl = raw.redirect_url?.trim()

  if (!title || !description || !applyUrl) return null

  const postedAt = raw.created && !Number.isNaN(Date.parse(raw.created))
    ? new Date(raw.created).toISOString()
    : new Date().toISOString()

  if (!isFreshDate(postedAt, MAX_JOB_AGE_DAYS)) return null

  const textBlob = `${title} ${description}`

  return {
    title,
    company: raw.company?.display_name?.trim() || 'Unknown Company',
    location: raw.location?.display_name?.trim() || 'India',
    type: inferType(textBlob),
    salary_min: typeof raw.salary_min === 'number' ? Math.round(raw.salary_min) : null,
    salary_max: typeof raw.salary_max === 'number' ? Math.round(raw.salary_max) : null,
    currency: 'INR',
    description,
    skills: extractSkills(textBlob),
    apply_url: applyUrl,
    source: 'adzuna',
    external_id: toExternalId('adzuna', raw.id),
    posted_at: postedAt,
  }
}

function greenhouseToJobInsert(raw: GreenhouseJob, board: string): JobInsert | null {
  const title = raw.title?.trim()
  const description = sanitizeText(raw.content)
  const applyUrl = raw.absolute_url?.trim()

  if (!title || !description || !applyUrl) return null

  const postedAt = raw.updated_at && !Number.isNaN(Date.parse(raw.updated_at))
    ? new Date(raw.updated_at).toISOString()
    : new Date().toISOString()

  if (!isFreshDate(postedAt, MAX_JOB_AGE_DAYS)) return null

  const officeName = raw.offices?.[0]?.location?.name || raw.offices?.[0]?.name
  const location = raw.location?.name || officeName || 'Remote'
  const textBlob = `${title} ${description} ${location}`

  return {
    title,
    company: board,
    location,
    type: inferType(textBlob),
    salary_min: null,
    salary_max: null,
    currency: 'INR',
    description,
    skills: extractSkills(textBlob),
    apply_url: applyUrl,
    source: 'greenhouse',
    external_id: toExternalId('greenhouse', raw.id),
    posted_at: postedAt,
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' ').slice(0, 8000),
  })

  return response.data[0].embedding
}

async function fetchAdzunaJobs(): Promise<JobInsert[]> {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.warn('Skipping Adzuna sync because credentials are missing')
    return []
  }

  const jobs: JobInsert[] = []

  for (const query of SEARCH_QUERIES) {
    for (let page = 1; page <= ADZUNA_PAGES; page += 1) {
      const url =
        `https://api.adzuna.com/v1/api/jobs/in/search/${page}?` +
        `app_id=${ADZUNA_APP_ID}` +
        `&app_key=${ADZUNA_APP_KEY}` +
        `&what=${encodeURIComponent(query)}` +
        `&results_per_page=${ADZUNA_RESULTS_PER_QUERY}` +
        `&sort_by=date` +
        `&content-type=application/json`

      let response: Response
      try {
        response = await fetchWithRetry(url)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown network error'
        console.warn(`Adzuna network failure for "${query}" page ${page}: ${message}`)
        continue
      }

      if (!response.ok) {
        console.warn(`Adzuna fetch failed for "${query}" page ${page}: ${response.status}`)
        continue
      }

      let data: { results?: AdzunaJob[] }
      try {
        data = (await response.json()) as { results?: AdzunaJob[] }
      } catch {
        console.warn(`Adzuna response parse failed for "${query}" page ${page}`)
        continue
      }
      const results = data.results ?? []

      for (const item of results) {
        const transformed = adzunaToJobInsert(item)
        if (transformed) {
          jobs.push(transformed)
        }
      }
    }
  }

  return jobs
}

async function fetchGreenhouseJobs(): Promise<JobInsert[]> {
  const jobs: JobInsert[] = []

  for (const board of GREENHOUSE_BOARDS) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`

    try {
      const response = await fetchWithRetry(url)
      if (!response.ok) {
        console.warn(`Greenhouse fetch failed for board ${board}: ${response.status}`)
        continue
      }

      const payload = (await response.json()) as GreenhouseBoardJobsResponse
      for (const ghJob of payload.jobs ?? []) {
        const transformed = greenhouseToJobInsert(ghJob, board)
        if (transformed) {
          jobs.push(transformed)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown network error'
      console.warn(`Greenhouse fetch error for board ${board}: ${message}`)
    }
  }

  return jobs
}

function dedupeByExternalId(jobs: JobInsert[]): JobInsert[] {
  const map = new Map<string, JobInsert>()
  for (const job of jobs) {
    map.set(job.external_id, job)
  }
  return [...map.values()]
}

async function pruneStaleJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - PRUNE_JOB_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('jobs')
    .delete()
    .in('source', ['adzuna', 'greenhouse'])
    .lt('posted_at', cutoff)
    .select('id')

  if (error) {
    console.warn('Failed to prune stale jobs:', error.message)
    return 0
  }

  return data?.length ?? 0
}

export async function pruneJobs(): Promise<number> {
  return pruneStaleJobs()
}

async function upsertJob(job: JobInsert): Promise<'inserted' | 'updated' | 'skipped'> {
  const { data: existing, error: existingError } = await supabase
    .from('jobs')
    .select('id, external_id, title, company, location, type, description, apply_url, posted_at, skills')
    .eq('external_id', job.external_id)
    .maybeSingle<JobsTableRow>()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    const existingSkills = Array.isArray(existing.skills) ? existing.skills : []
    const existingSkillsKey = [...existingSkills].sort().join('|')
    const nextSkillsKey = [...job.skills].sort().join('|')

    const unchanged =
      existing.title === job.title &&
      existing.company === job.company &&
      existing.location === job.location &&
      existing.type === job.type &&
      existing.description === job.description &&
      existing.apply_url === job.apply_url &&
      existing.posted_at === job.posted_at &&
      existingSkillsKey === nextSkillsKey

    if (unchanged) {
      return 'skipped'
    }
  }

  const embeddingText = [
    job.title,
    job.company,
    `${job.location} ${job.type}`,
    job.description,
    `Skills: ${job.skills.join(', ')}`,
  ].join('\n')

  const embedding = await generateEmbedding(embeddingText)

  if (!existing) {
    const { error } = await supabase
      .from('jobs')
      .insert({
        ...job,
        embedding,
      })

    if (error) throw new Error(error.message)
    return 'inserted'
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      ...job,
      embedding,
    })
    .eq('id', existing.id)

  if (error) throw new Error(error.message)
  return 'updated'
}

export async function fetchAndEmbedJobs(options: SyncOptions = {}): Promise<SyncStats> {
  const selectedSources = options.sources?.length
    ? options.sources
    : ['adzuna', 'greenhouse'] satisfies SyncSource[]
  const shouldPrune = options.includePrune ?? true

  const stats: SyncStats = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    pruned: 0,
    fetched: 0,
    sourceBreakdown: {
      adzuna: 0,
      greenhouse: 0,
    },
    errors: [],
  }

  const adzunaPromise = selectedSources.includes('adzuna')
    ? fetchAdzunaJobs()
    : Promise.resolve([] as JobInsert[])

  const greenhousePromise = selectedSources.includes('greenhouse')
    ? fetchGreenhouseJobs()
    : Promise.resolve([] as JobInsert[])

  const [adzunaJobs, greenhouseJobs] = await Promise.all([adzunaPromise, greenhousePromise])

  stats.sourceBreakdown.adzuna = adzunaJobs.length
  stats.sourceBreakdown.greenhouse = greenhouseJobs.length

  const jobs = dedupeByExternalId([...adzunaJobs, ...greenhouseJobs])
  stats.fetched = jobs.length

  if (selectedSources.includes('adzuna') && adzunaJobs.length === 0) {
    stats.errors.push('Adzuna returned 0 jobs (likely transient network/API availability issue).')
  }

  if (selectedSources.includes('greenhouse') && greenhouseJobs.length === 0) {
    stats.errors.push('Greenhouse returned 0 jobs (board list may be empty/private or temporarily unavailable).')
  }

  for (const job of jobs) {
    try {
      const action = await upsertJob(job)
      if (action === 'inserted') stats.inserted += 1
      if (action === 'updated') stats.updated += 1
      if (action === 'skipped') stats.skipped += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sync error'
      stats.errors.push(`${job.title}: ${message}`)
    }

    // Gentle pacing for OpenAI + DB load.
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  if (shouldPrune) {
    stats.pruned = await pruneStaleJobs()
  }

  return stats
}

const isDirectRun =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  fetchAndEmbedJobs()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
      if (result.errors.length > 0) {
        process.exitCode = 1
      }
    })
    .catch((err) => {
      console.error('Script failed:', err)
      process.exit(1)
    })
}
