import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { player_id, subscription } = req.body
  if (!player_id || !subscription) return res.status(400).json({ error: 'Missing fields' })

  await admin.from('push_subscriptions').upsert(
    { player_id, subscription },
    { onConflict: 'player_id' }
  )
  return res.json({ ok: true })
}
