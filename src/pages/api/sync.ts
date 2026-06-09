import type { NextApiRequest, NextApiResponse } from 'next'
import { syncFromOddsAPI } from '@/lib/oddsSync'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers['authorization']
  const bodySecret = (req.body as any)?.secret
  const querySecret = req.query?.secret as string

  // Accept: Vercel cron header OR any configured secret OR open if nothing configured
  const isAuthorized =
    !cronSecret ||                                          // no secret = open
    authHeader === `Bearer ${cronSecret}` ||               // Vercel cron
    bodySecret  === cronSecret ||                          // body match
    querySecret === cronSecret                             // query match

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const result = await syncFromOddsAPI()
  return res.status(200).json({ ok: !result.error, ...result, timestamp: new Date().toISOString() })
}
