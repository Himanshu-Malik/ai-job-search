import { NextRequest, NextResponse } from 'next/server'
import { fetchAndEmbedJobs } from '@/scripts/real-time-data'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await fetchAndEmbedJobs({
      sources: ['adzuna'],
      includePrune: false,
    })

    return NextResponse.json({
      success: true,
      source: 'adzuna',
      ...result,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      {
        success: false,
        source: 'adzuna',
        error: 'Failed to sync Adzuna jobs',
      },
      { status: 500 }
    )
  }
}
