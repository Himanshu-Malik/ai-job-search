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


export interface UserProfile {
  id: string
  user_id: string
  email: string
  name?: string
  avatar_url?: string
  extracted_name?: string
  current_position?: string      // ← matches the DB column name
  experience_years?: number
  summary?: string
  skills: string[]
  preferred_location?: string
  preferred_type?: string
  salary_min?: number
  salary_max?: number
  onboarding_complete: boolean
}