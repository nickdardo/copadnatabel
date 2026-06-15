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

  const { title, body, player_id, player_ids } = req.body
  if (!title || !body) return res.status(400).json({ error: 'title and body required' })

  const query = admin.from('push_subscriptions').select('player_id, subscription')
  if (player_id) query.eq('player_id', player_id)
  else if (Array.isArray(player_ids) && player_ids.length > 0) query.in('player_id', player_ids)
  const { data: subs } = await query

  if (!subs || subs.length === 0) return res.json({ ok: true, sent: 0 })

  const payload = JSON.stringify({ title, body, icon: '/icon-192.png', badge: '/icon-192.png' })
  let sent = 0

  await Promise.allSettled(
    subs.map(async (row: { player_id: string; subscription: PushSubscription }) => {
      try {
        await webpush.sendNotification(row.subscription as unknown as webpush.PushSubscription, payload)
        sent++
      } catch {}
    })
  )

  // ── Save to notification_log so collaborators see it in the bell dropdown
  const now = new Date().toISOString()
  const playerIds = subs.map((r: { player_id: string }) => r.player_id)

  // Insert one log entry per recipient
  const logEntries = playerIds.map((pid: string) => ({
    player_id: pid,
    title,
    body,
    sent_at: now,
  }))

  if (logEntries.length > 0) {
    await admin.from('notification_log').insert(logEntries)

    // Keep only last 5 per player — delete older ones
    for (const pid of playerIds) {
      const { data: old } = await admin
        .from('notification_log')
        .select('id')
        .eq('player_id', pid)
        .order('sent_at', { ascending: false })
        .range(5, 100)
      if (old && old.length > 0) {
        await admin.from('notification_log').delete().in('id', old.map((r: { id: string }) => r.id))
      }
    }
  }

  return res.json({ ok: true, sent })
}
