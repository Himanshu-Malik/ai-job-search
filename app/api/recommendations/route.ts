import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/openai'
import {
  redis,
  recommendationsCacheKey,
  RECOMMENDATIONS_CACHE_TTL_SECONDS,
} from '@/lib/redis'
import type { SearchResponse } from '@/lib/types'

const DEFAULT_RECOMMENDATION_COUNT = Number(process.env.RECOMMENDATION_COUNT ?? 24)
const RECOMMENDATION_CANDIDATE_COUNT = Number(process.env.RECOMMENDATION_CANDIDATE_COUNT ?? 60)

type UserProfileRow = {
  summary: string | null
  raw_resume_text?: string | null
  skills: string[] | string | null
  resume_embedding?: number[] | null
  onboarding_complete: boolean
  updated_at?: string | null
}

function normalizeSkills(value: UserProfileRow['skills']): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string')
      }
    } catch {
      return []
    }
  }

  return []
}

function buildProfileText(profile: UserProfileRow): string {
  const skillsText = normalizeSkills(profile.skills).join(', ')
  return [profile.raw_resume_text || '', profile.summary || '', `Skills: ${skillsText}`]
    .filter(Boolean)
    .join('\n')
}

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('summary, raw_resume_text, skills, resume_embedding, onboarding_complete, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 })
    }

    const profile = data as UserProfileRow

    const cacheKey = recommendationsCacheKey(session.user.id, profile.updated_at ?? null)
    try {
      const cached = await redis.get<SearchResponse>(cacheKey)
      if (cached) {
        return NextResponse.json({ ...cached, cached: true })
      }
    } catch (cacheErr) {
      console.warn('Recommendations cache unavailable, skipping cache read:', cacheErr)
    }

    if (!profile.onboarding_complete) {
      return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
    }

    let queryEmbedding = profile.resume_embedding

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      const profileText = buildProfileText(profile)

      if (!profileText.trim()) {
        return NextResponse.json({ error: 'Resume profile is empty.' }, { status: 400 })
      }

      queryEmbedding = await generateEmbedding(profileText)

      const { error: persistError } = await supabaseAdmin
        .from('user_profiles')
        .update({ resume_embedding: queryEmbedding })
        .eq('user_id', session.user.id)

      if (persistError) {
        console.warn('Could not persist resume embedding from recommendations:', persistError)
      }
    }

    let jobs: SearchResponse['jobs'] | null = null
    let jobsError: unknown = null
    const targetCount = Math.max(12, Math.min(60, DEFAULT_RECOMMENDATION_COUNT))
    const candidateThresholds = [0.25, 0.18, 0.12, 0]

    for (const threshold of candidateThresholds) {
      const resumeFnResult = await supabaseAdmin.rpc('match_jobs_for_resume', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: RECOMMENDATION_CANDIDATE_COUNT,
      })

      jobs = (resumeFnResult.data as SearchResponse['jobs'] | null) ?? []
      jobsError = resumeFnResult.error

      // Fallback for environments where only match_jobs exists or signatures differ.
      if (jobsError) {
        const fallbackResult = await supabaseAdmin.rpc('match_jobs', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: RECOMMENDATION_CANDIDATE_COUNT,
        })

        jobs = (fallbackResult.data as SearchResponse['jobs'] | null) ?? []
        jobsError = fallbackResult.error
      }

      if (jobsError) {
        break
      }

      if ((jobs?.length ?? 0) >= targetCount) {
        break
      }
    }

    if (jobsError) {
      return NextResponse.json({ error: 'Could not fetch recommended jobs.' }, { status: 500 })
    }

    const response: SearchResponse = {
      jobs: (jobs ?? []).slice(0, targetCount),
      cached: false,
      query: 'resume-profile',
    }

    redis
      .set(cacheKey, response, { ex: RECOMMENDATIONS_CACHE_TTL_SECONDS })
      .catch((cacheErr) => {
        console.warn('Could not cache recommendations:', cacheErr)
      })

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
