import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  'mailto:admin@bolaocopabel.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { title, body, player_id } = req.body
  if (!title || !body) return res.status(400).json({ error: 'title and body required' })

  // Buscar subscriptions (todos ou um específico)
  const query = admin.from('push_subscriptions').select('subscription')
  if (player_id) query.eq('player_id', player_id)
  const { data: subs } = await query

  if (!subs || subs.length === 0) return res.json({ ok: true, sent: 0 })

  const payload = JSON.stringify({ title, body, icon: '/icon-192.png', badge: '/icon-192.png' })
  let sent = 0

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload)
        sent++
      } catch {}
    })
  )

  return res.json({ ok: true, sent })
}
