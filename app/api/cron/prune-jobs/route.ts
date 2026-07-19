import { NextRequest, NextResponse } from 'next/server'
import { pruneJobs } from '@/scripts/real-time-data'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const pruned = await pruneJobs()

    return NextResponse.json({
      success: true,
      source: 'prune',
      pruned,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      {
        success: false,
        source: 'prune',
        error: 'Failed to prune stale jobs',
      },
      { status: 500 }
    )
  }
}
