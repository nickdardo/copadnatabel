import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { data } = await admin
      .from('activity_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    return res.json({ ok: true, data: data || [] })
  }

  if (req.method === 'POST') {
    const event = req.body
    if (!event.type) return res.status(400).json({ error: 'type required' })
    await admin.from('activity_feed').insert(event)
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
