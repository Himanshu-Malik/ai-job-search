import { NextRequest, NextResponse } from 'next/server'
import { fetchAndEmbedJobs, pruneJobs } from '@/scripts/real-time-data'

type TriggerTarget = 'adzuna' | 'greenhouse' | 'all' | 'prune'

const ALLOWED_TARGETS: TriggerTarget[] = ['adzuna', 'greenhouse', 'all', 'prune']

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

function parseTarget(value: unknown): TriggerTarget | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase() as TriggerTarget
  return ALLOWED_TARGETS.includes(normalized) ? normalized : null
}

async function runTarget(target: TriggerTarget) {
  if (target === 'prune') {
    const pruned = await pruneJobs()
    return {
      success: true,
      target,
      pruned,
    }
  }

  if (target === 'all') {
    const result = await fetchAndEmbedJobs({
      sources: ['adzuna', 'greenhouse'],
      includePrune: true,
    })

    return {
      success: true,
      target,
      ...result,
    }
  }

  const result = await fetchAndEmbedJobs({
    sources: [target],
    includePrune: false,
  })

  return {
    success: true,
    target,
    ...result,
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const target = parseTarget(req.nextUrl.searchParams.get('target') ?? 'all')

  if (!target) {
    return NextResponse.json(
      {
        error: 'Invalid target. Use one of: adzuna, greenhouse, all, prune',
      },
      { status: 400 }
    )
  }

  try {
    const payload = await runTarget(target)
    return NextResponse.json(payload)
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      {
        success: false,
        target,
        error: 'Failed to run manual trigger',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const target = parseTarget((body as { target?: unknown })?.target ?? 'all')

  if (!target) {
    return NextResponse.json(
      {
        error: 'Invalid target. Use one of: adzuna, greenhouse, all, prune',
      },
      { status: 400 }
    )
  }

  try {
    const payload = await runTarget(target)
    return NextResponse.json(payload)
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      {
        success: false,
        target,
        error: 'Failed to run manual trigger',
      },
      { status: 500 }
    )
  }
}
