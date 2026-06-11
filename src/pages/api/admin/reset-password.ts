// POST /api/admin/reset-password
// Resets a player's password — admin only, uses service_role
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { player_id, new_password } = req.body
  if (!player_id || !new_password) return res.status(400).json({ error: 'player_id and new_password required' })
  if (new_password.length < 4) return res.status(400).json({ error: 'Senha deve ter pelo menos 4 caracteres' })

  const { error } = await admin.rpc('reset_player_password', {
    p_player_id: player_id,
    p_new_password: new_password,
  })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
}
