// GET /api/push/log?player_id=xxx
// Returns last 5 notifications for a player
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const { player_id } = req.query
  if (!player_id || typeof player_id !== 'string') return res.status(400).json({ error: 'player_id required' })

  const { data } = await admin
    .from('notification_log')
    .select('id, title, body, sent_at')
    .eq('player_id', player_id)
    .order('sent_at', { ascending: false })
    .limit(5)

  return res.json({ ok: true, data: data || [] })
}
