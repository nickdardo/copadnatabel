// GET /api/admin/push-status
// Returns list of player_ids that have push subscriptions
// Uses service_role to bypass RLS
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('player_id')

  if (error) return res.status(500).json({ error: error.message })

  const playerIds = (data || []).map((r: { player_id: string }) => r.player_id)
  return res.json({ ok: true, playerIds })
}
