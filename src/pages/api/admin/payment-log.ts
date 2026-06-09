import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { data } = await admin
      .from('payment_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    return res.json({ ok: true, data: data || [] })
  }

  if (req.method === 'POST') {
    const { player_id, player_name, action, confirmed_by, valor } = req.body
    await admin.from('payment_logs').insert({ player_id, player_name, action, confirmed_by, valor: valor || 10 })
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
