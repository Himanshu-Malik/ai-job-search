import { NextRequest, NextResponse } from 'next/server'
import { fetchAndEmbedJobs } from '@/scripts/real-time-data'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await fetchAndEmbedJobs({
      sources: ['greenhouse'],
      includePrune: false,
    })

    return NextResponse.json({
      success: true,
      source: 'greenhouse',
      ...result,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      {
        success: false,
        source: 'greenhouse',
        error: 'Failed to sync Greenhouse jobs',
      },
      { status: 500 }
    )
  }
}
