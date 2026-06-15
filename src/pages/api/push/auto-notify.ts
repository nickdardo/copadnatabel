// POST /api/push/auto-notify
// Notification types (in order per match):
//   1. T-2h   "Palpites fecham"   (notified_6h)   — already exists
//   2. T-30m  "Jogo em breve"     (notified_30m)   — new
//   3. T+0    "Jogo começou"      (notified_live)  — new
//   4. T+90m  "Resultado final"   (notified_result) — already exists
//   5. Post-recalc "Novo líder"                    — new
//   6. Post-recalc "Subiu ≥3 posições" (individual) — new
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

async function pushPayload(
  subs: { player_id: string; subscription: unknown }[],
  title: string,
  body: string
): Promise<number> {
  if (!subs || subs.length === 0) return 0
  const payload = JSON.stringify({ title, body, icon: '/icon-192.png', badge: '/icon-192.png' })
  let sent = 0
  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload)
        sent++
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err) {
          const e = err as { statusCode: number }
          if (e.statusCode === 410 || e.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions').delete()
              .eq('player_id', row.player_id)
          }
        }
      }
    })
  )
  // Log notifications
  const now = new Date().toISOString()
  const entries = subs.map((r) => ({ player_id: r.player_id, title, body, sent_at: now }))
  if (entries.length > 0) {
    await supabaseAdmin.from('notification_log').insert(entries)
    for (const sub of subs) {
      const { data: old } = await supabaseAdmin
        .from('notification_log').select('id').eq('player_id', sub.player_id)
        .order('sent_at', { ascending: false }).range(5, 100)
      if (old && old.length > 0)
        await supabaseAdmin.from('notification_log').delete().in('id', old.map((r: { id: string }) => r.id))
    }
  }
  return sent
}

async function sendToAll(title: string, body: string): Promise<number> {
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('player_id, subscription')
  return pushPayload(subs || [], title, body)
}

async function sendToPlayer(player_id: string, title: string, body: string): Promise<number> {
  const { data: subs } = await supabaseAdmin.from('push_subscriptions')
    .select('player_id, subscription').eq('player_id', player_id)
  return pushPayload(subs || [], title, body)
}

function timeBRT(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const now       = new Date()
  const in2h      = new Date(now.getTime() + 2     * 3600  * 1000)
  const in2h15    = new Date(now.getTime() + 2.25  * 3600  * 1000)
  const in25min   = new Date(now.getTime() + 25    * 60    * 1000)
  const in35min   = new Date(now.getTime() + 35    * 60    * 1000)
  const ago5min   = new Date(now.getTime() - 5     * 60    * 1000)
  const ago35min  = new Date(now.getTime() - 35    * 60    * 1000)

  const notifications: { type: string; title: string; body: string; sent: number }[] = []
  const TITLE = 'Bolão Copa 2026 BEL'

  // ── 1. T-2h  Palpites fecham ────────────────────────────────
  const { data: upcoming2h } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, match_date')
    .eq('status', 'upcoming')
    .gte('match_date', in2h.toISOString())
    .lte('match_date', in2h15.toISOString())
    .neq('notified_6h', true)

  for (const m of (upcoming2h || [])) {
    const body = `${m.home_team} × ${m.away_team} começa às ${timeBRT(m.match_date)} (Brasília). Palpites fecham em 2h — faça o seu!`
    const sent = await sendToAll(TITLE, body)
    await supabaseAdmin.from('matches').update({ notified_6h: true, notified_30m: true }).eq('id', m.id)
    notifications.push({ type: '2h_warning', title: TITLE, body, sent })
  }

  // ── 2. T-30min  Jogo em breve (só informativo) ──────────────
  const { data: upcoming30m } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, match_date')
    .eq('status', 'upcoming')
    .gte('match_date', in25min.toISOString())
    .lte('match_date', in35min.toISOString())
    .neq('notified_30m', true)

  for (const m of (upcoming30m || [])) {
    const body = `${m.home_team} × ${m.away_team} começa em 30 minutos. Acompanhe ao vivo!`
    const sent = await sendToAll(TITLE, body)
    await supabaseAdmin.from('matches').update({ notified_30m: true }).eq('id', m.id)
    notifications.push({ type: '30m_warning', title: TITLE, body, sent })
  }

  // ── 3. T+0  Jogo começou ────────────────────────────────────
  const { data: liveMatches } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team')
    .eq('status', 'live')
    .neq('notified_live', true)

  for (const m of (liveMatches || [])) {
    const body = `${m.home_team} × ${m.away_team} acabou de começar! Acompanhe ao vivo.`
    const sent = await sendToAll(TITLE, body)
    await supabaseAdmin.from('matches').update({ notified_live: true }).eq('id', m.id)
    notifications.push({ type: 'live_started', title: TITLE, body, sent })
  }

  // ── 4. T+90min  Resultado final ─────────────────────────────
  const { data: finished } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, score_home, score_away')
    .eq('status', 'done')
    .gte('updated_at', ago35min.toISOString())
    .lte('updated_at', ago5min.toISOString())
    .neq('notified_result', true)

  for (const m of (finished || [])) {
    if (m.score_home == null || m.score_away == null) continue
    const h = Number(m.score_home), a = Number(m.score_away)
    const winner = h > a ? m.home_team : a > h ? m.away_team : 'Empate'
    const body = winner === 'Empate'
      ? `Empate! ${m.home_team} ${h}×${a} ${m.away_team}. Confira sua pontuação no ranking!`
      : `${winner} venceu! ${m.home_team} ${h}×${a} ${m.away_team}. Confira sua pontuação!`
    const sent = await sendToAll(TITLE, body)
    await supabaseAdmin.from('matches').update({ notified_result: true }).eq('id', m.id)
    notifications.push({ type: 'result', title: TITLE, body, sent })
  }

  // ── 5. Novo líder (após recalc) ─────────────────────────────
  // Detect player who has rank_position=1 but prev_position > 1 (changed to leader)
  const { data: newLeaderRows } = await supabaseAdmin
    .from('scores')
    .select('player_id, rank_position, prev_position, total_pts, players(nickname, username)')
    .eq('rank_position', 1)
    .gt('prev_position', 1)
    .limit(1)

  if (newLeaderRows && newLeaderRows.length > 0) {
    const leader = newLeaderRows[0]
    const raw = leader.players
    const p = (Array.isArray(raw) ? raw[0] : raw) as { nickname?: string; username?: string } | null
    const name = p?.nickname || p?.username || 'Alguém'
    const body = `Temos um novo líder! ${name} assumiu a 1ª posição com ${leader.total_pts} pts. Confira o ranking!`
    const sent = await sendToAll(TITLE, body)
    // Mark: set prev_position = rank_position so it won't fire again until next change
    await supabaseAdmin.from('scores')
      .update({ prev_position: 1 }).eq('player_id', leader.player_id)
    notifications.push({ type: 'new_leader', title: TITLE, body, sent })
  }

  // ── 6. Subiu ≥3 posições — notificação individual ───────────
  const { data: movers } = await supabaseAdmin
    .from('scores')
    .select('player_id, rank_position, prev_position')
    .not('prev_position', 'is', null)
    .gt('prev_position', 1) // rank_position=1 already handled above

  for (const s of (movers || [])) {
    if (!s.prev_position || !s.rank_position) continue
    const gain = s.prev_position - s.rank_position
    if (gain < 3) continue
    const ordinal = (n: number) => `${n}ª`
    const body = `Você subiu para a ${ordinal(s.rank_position)} posição no ranking! Continue assim.`
    await sendToPlayer(s.player_id, TITLE, body)
    // Mark so it won't fire again for the same move
    await supabaseAdmin.from('scores').update({ prev_position: s.rank_position }).eq('player_id', s.player_id)
    notifications.push({ type: 'rank_up', title: TITLE, body, sent: 1 })
  }

  return res.json({ ok: true, notifications, total: notifications.length })
}
