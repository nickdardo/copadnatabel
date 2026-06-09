// POST /api/presence
// Updates last_seen_at for the logged-in player.
// Uses service_role key to bypass RLS restrictions on the players table.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { player_id } = req.body
  if (!player_id || typeof player_id !== 'string') {
    return res.status(400).json({ error: 'player_id required' })
  }

  const { error } = await supabaseAdmin
    .from('players')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', player_id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
