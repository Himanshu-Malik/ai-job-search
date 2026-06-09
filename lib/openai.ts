import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// Converts any text into a 1536-number vector
// This is the core of semantic search
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',  // cheapest + fast, 1536 dims
    input: text.replace(/\n/g, ' '),  // newlines confuse the model
  })
  return response.data[0].embedding
}

// Builds the text we embed for a job
// More context = better search results
export function buildJobText(job: {
  title: string
  company: string
  location: string
  type: string
  description: string
  skills: string[]
  experience?: string
}): string {
  return [
    job.title,
    job.company,
    `${job.location} ${job.type}`,
    job.experience ? `${job.experience} years experience` : '',
    job.description,
    `Skills: ${job.skills.join(', ')}`,
  ].filter(Boolean).join('\n')
}