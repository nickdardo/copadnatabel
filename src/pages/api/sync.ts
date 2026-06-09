import type { NextApiRequest, NextApiResponse } from 'next'
import { syncFromOddsAPI } from '@/lib/oddsSync'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Protection: check CRON_SECRET OR ADMIN_NICKNAME
  const cronSecret  = process.env.CRON_SECRET
  const adminNick   = process.env.NEXT_PUBLIC_ADMIN_NICKNAME?.toLowerCase()

  const authHeader  = req.headers['authorization']
  const bodySecret  = (req.body as any)?.secret?.toLowerCase()
  const querySecret = (req.query?.secret as string)?.toLowerCase()

  const isAuthorized =
    // Vercel cron job
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    // Manual from admin panel — accepts cron secret OR admin nickname
    (cronSecret && (bodySecret === cronSecret || querySecret === cronSecret)) ||
    (adminNick  && (bodySecret === adminNick  || querySecret === adminNick))  ||
    // No secret configured — allow all (dev mode)
    (!cronSecret && !adminNick)

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('[/api/sync] Starting sync...')
  const result = await syncFromOddsAPI()
  console.log('[/api/sync] Done:', result)

  return res.status(200).json({
    ok: !result.error,
    ...result,
    timestamp: new Date().toISOString(),
  })
}
