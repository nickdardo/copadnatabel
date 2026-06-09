import type { NextApiRequest, NextApiResponse } from 'next'
import { syncFromOddsAPI } from '@/lib/oddsSync'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  // Only protect with CRON_SECRET if it's set (for Vercel cron jobs)
  // Manual calls from admin panel are allowed freely
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers['authorization']
    // Only enforce for automated cron calls (Authorization header)
    // Manual POST calls from admin panel bypass this check
    if (auth && auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const result = await syncFromOddsAPI()
  return res.status(200).json({ ok: !result.error, ...result, timestamp: new Date().toISOString() })
}
