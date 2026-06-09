// Matches the jobs table in Supabase exactly
export interface Job {
  id: string
  title: string
  company: string
  location: string
  type: 'remote' | 'hybrid' | 'onsite'
  salary_min?: number
  salary_max?: number
  currency: string
  experience?: string
  description: string
  skills: string[]
  apply_url?: string
  posted_at: string
  similarity?: number  // only present in search results
}

export interface SearchResponse {
  jobs: Job[]
  cached: boolean
  query: string
}