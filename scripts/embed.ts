// scripts/embed.ts
// Run with: npx tsx scripts/embed.ts
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'
import ws from 'ws'

dotenv.config({ path: '.env.development' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
      realtime: { transport: ws as unknown as typeof WebSocket },
}
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  })
  return res.data[0].embedding
}

async function embed() {
  // Fetch all jobs that don't have an embedding yet
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, company, location, type, description, skills, experience')
    .is('embedding', null)

  if (error) { console.error(error.message); process.exit(1) }
  if (!jobs?.length) { console.log('No jobs to embed.'); return }

  console.log(`Embedding ${jobs.length} jobs...`)

  for (const job of jobs) {
    // Combine all fields — richer text = better search results
    const text = [
      job.title,
      job.company,
      `${job.location} ${job.type}`,
      job.experience ? `${job.experience} years experience` : '',
      job.description,
      `Skills: ${(job.skills || []).join(', ')}`,
    ].filter(Boolean).join('\n')

    const embedding = await generateEmbedding(text)

    const { error: updateErr } = await supabase
      .from('jobs')
      .update({ embedding })
      .eq('id', job.id)

    if (updateErr) {
      console.error(`Failed to embed "${job.title}":`, updateErr.message)
    } else {
      console.log(`✓ ${job.title} at ${job.company}`)
    }

    // Small delay to avoid OpenAI rate limits
    await new Promise(r => setTimeout(r, 100))
  }

  console.log('\nAll jobs embedded! Semantic search is ready.')
}

embed()