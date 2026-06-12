// POST /api/push/auto-notify
// Checks for matches starting in ~6h and sends push notifications.
// Also checks for matches that just finished and sends result notifications.
// Called by the admin panel auto-check or manually triggered.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  'mailto:admin@bolaocopabel.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

async function sendToAll(title: string, body: string) {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('player_id, subscription')

  if (!subs || subs.length === 0) return 0

  const payload = JSON.stringify({ title, body, icon: '/icon-192.png', badge: '/icon-192.png' })
  let sent = 0

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload)
        sent++
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err) {
          const e = err as { statusCode: number }
          if (e.statusCode === 410 || e.statusCode === 404) {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('subscription', row.subscription)
          }
        }
      }
    })
  )

  // Save to notification_log for each recipient
  const now = new Date().toISOString()
  const logEntries = subs.map((r: { player_id: string }) => ({ player_id: r.player_id, title, body, sent_at: now }))
  if (logEntries.length > 0) {
    await supabaseAdmin.from('notification_log').insert(logEntries)
    // Keep only last 5 per player
    for (const sub of subs) {
      const { data: old } = await supabaseAdmin
        .from('notification_log').select('id').eq('player_id', sub.player_id)
        .order('sent_at', { ascending: false }).range(5, 100)
      if (old && old.length > 0) {
        await supabaseAdmin.from('notification_log').delete().in('id', old.map((r: { id: string }) => r.id))
      }
    }
  }
  return sent
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const now      = new Date()
  const in2h     = new Date(now.getTime() + 2 * 3600 * 1000)
  const in2h15   = new Date(now.getTime() + 2.25 * 3600 * 1000)
  const ago5min  = new Date(now.getTime() - 5 * 60 * 1000)
  const ago35min = new Date(now.getTime() - 35 * 60 * 1000)

  const notifications: { type: string; title: string; body: string; sent: number }[] = []

  // ── 1. Games starting in ~6h ──────────────────────────────
  const { data: upcoming } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, match_date, fase, notified_6h')
    .eq('status', 'upcoming')
    .gte('match_date', in2h.toISOString())
    .lte('match_date', in2h15.toISOString())
    .neq('notified_6h', true)

  for (const match of (upcoming || [])) {
    const homeTime = new Date(match.match_date).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
    })
    const title = `Bolão Copa 2026 BEL`
    const body  = `${match.home_team} × ${match.away_team} começa às ${homeTime} (Brasília). Palpites fecham em 2h — faça o seu!`

    const sent = await sendToAll(title, body)

    // Mark as notified
    await supabaseAdmin
      .from('matches')
      .update({ notified_6h: true })
      .eq('id', match.id)

    notifications.push({ type: '6h_warning', title, body, sent })
  }

  // ── 2. Games that just finished (status turned done) ──────
  const { data: finished } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, score_home, score_away, notified_result, updated_at')
    .eq('status', 'done')
    .gte('updated_at', ago35min.toISOString())
    .lte('updated_at', ago5min.toISOString())
    .neq('notified_result', true)

  for (const match of (finished || [])) {
    if (match.score_home == null || match.score_away == null) continue

    const scoreH = Number(match.score_home)
    const scoreA = Number(match.score_away)

    let winner: string
    if (scoreH > scoreA)       winner = match.home_team
    else if (scoreA > scoreH)  winner = match.away_team
    else                       winner = 'Empate'

    const title = `Bolão Copa 2026 BEL`

    const body = winner === 'Empate'
      ? `Empate! ${match.home_team} ${scoreH}×${scoreA} ${match.away_team}. Confira a pontuação no ranking!`
      : `${winner} venceu! ${match.home_team} ${scoreH}×${scoreA} ${match.away_team}. Confira sua pontuação!`

    const sent = await sendToAll(title, body)

    await supabaseAdmin
      .from('matches')
      .update({ notified_result: true })
      .eq('id', match.id)

    notifications.push({ type: 'result', title, body, sent })
  }

  return res.json({ ok: true, notifications, total: notifications.length })
}
