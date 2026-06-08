/**
 * POST /api/sync  or  GET /api/sync
 *
 * Called by Vercel Cron (vercel.json) every 5 min during tournament.
 * Protected by CRON_SECRET header.
 * Also callable manually from the admin panel.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { syncFromOddsAPI } from '@/lib/oddsSync'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Protect cron route
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader  = req.headers['authorization']
    const bodySecret  = (req.body as any)?.secret
    const querySecret = req.query?.secret
    if (
      authHeader !== `Bearer ${secret}` &&
      bodySecret !== secret &&
      querySecret !== secret
    ) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  console.log('[/api/sync] Starting sync...')
  const result = await syncFromOddsAPI()
  console.log('[/api/sync] Done:', result)

  return res.status(200).json({ ok: !result.error, ...result, timestamp: new Date().toISOString() })
}
