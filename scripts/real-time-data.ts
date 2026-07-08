// lib/real-time-data.ts

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

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID!
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY!

const SEARCH_QUERIES = [
  'react developer',
  'frontend engineer',
  'next js developer',
  'full stack developer react',
  'senior frontend engineer',
  'typescript developer',
]

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

function extractSkills(text: string): string[] {
  return SKILL_KEYWORDS.filter(skill =>
    text.toLowerCase().includes(skill.toLowerCase())
  ).slice(0, 6)
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' ').slice(0, 8000),
  })

  return response.data[0].embedding
}

function transformJob(raw: any) {
  const salaryMin = raw.salary_min
    ? Math.round(raw.salary_min)
    : null

  const salaryMax = raw.salary_max
    ? Math.round(raw.salary_max)
    : null

  const text = `${raw.title} ${raw.description}`.toLowerCase()

  let type: 'remote' | 'hybrid' | 'onsite' = 'onsite'

  if (text.includes('remote')) {
    type = 'remote'
  } else if (text.includes('hybrid')) {
    type = 'hybrid'
  }

  return {
    title: raw.title,
    company: raw.company?.display_name || 'Unknown Company',
    location: raw.location?.display_name || 'India',
    type,
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency: 'INR',
    description: raw.description?.slice(0, 2000) || '',
    skills: extractSkills(`${raw.title} ${raw.description}`),
    apply_url: raw.redirect_url,
    source: 'adzuna',
    external_id: raw.id,
  }
}

export async function fetchAndEmbedJobs() {
  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  for (const query of SEARCH_QUERIES) {
    console.log(`Fetching "${query}"...`)

    const url =
      `https://api.adzuna.com/v1/api/jobs/in/search/1?` +
      `app_id=${ADZUNA_APP_ID}` +
      `&app_key=${ADZUNA_APP_KEY}` +
      `&what=${encodeURIComponent(query)}` +
      `&results_per_page=15` +
      `&content-type=application/json`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        errors.push(`Failed to fetch "${query}" (${response.status})`)
        continue
      }

      const data = await response.json()
      const jobs = data.results ?? []

      console.log(`Found ${jobs.length} jobs`)

      for (const rawJob of jobs) {
        try {
          // Skip duplicates
          const { data: existing } = await supabase
            .from('jobs')
            .select('id')
            .eq('external_id', rawJob.id)
            .maybeSingle()

          if (existing) {
            skipped++
            continue
          }

          const job = transformJob(rawJob)

          const embeddingText = [
            job.title,
            job.company,
            `${job.location} ${job.type}`,
            job.description,
            `Skills: ${job.skills.join(', ')}`,
          ].join('\n')

          const embedding = await generateEmbedding(embeddingText)

          const { error } = await supabase
            .from('jobs')
            .insert({
              ...job,
              embedding,
            })

          if (error) {
            console.error(error)
            errors.push(`${job.title}: ${error.message}`)
            continue
          }

          inserted++
          console.log(`✓ ${job.title}`)
        } catch (err) {
          console.error(err)
          errors.push(`Error processing ${rawJob.title}`)
        }

        // avoid hitting API rate limits
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    } catch (err) {
      console.error(err)
      errors.push(`Failed query "${query}"`)
    }
  }

  console.log(
    `Finished. Inserted: ${inserted}, Skipped: ${skipped}`
  )

  return {
    inserted,
    skipped,
    errors,
  }
}

const isDirectRun =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  fetchAndEmbedJobs()
    .then(result => {
      if (result.errors.length > 0) {
        console.error(`Completed with ${result.errors.length} errors`)
        process.exitCode = 1
      }
    })
    .catch(err => {
      console.error('Script failed:', err)
      process.exit(1)
    })
}