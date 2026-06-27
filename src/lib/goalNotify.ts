import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { calcFactor, FACTOR_PTS, FACTOR_LABEL } from '@/lib/supabase'
import type { GoalEvent } from '@/lib/oddsSync'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  'mailto:admin@bolaocopabel.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

type PickRow = { player_id: string; pick_home: number; pick_away: number }
type SubRow  = { player_id: string; subscription: unknown }

// Notifica cada jogador que tem palpite no jogo, individualmente, com o
// placar do gol, o palpite dele e quantos pontos ele faria se o jogo
// acabasse agora com esse placar. Chamado pelo sync.ts sempre que o
// syncFromOddsAPI() detectar um gol num jogo ao vivo.
export async function notifyGoalEvents(events: GoalEvent[]): Promise<{ notified: number }> {
  let notified = 0

  for (const ev of events) {
    const { data: picks } = await supabaseAdmin
      .from('picks')
      .select('player_id, pick_home, pick_away')
      .eq('match_id', ev.matchId) as { data: PickRow[] | null }
    if (!picks || picks.length === 0) continue

    const playerIds = picks.map(p => p.player_id)
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('player_id, subscription')
      .in('player_id', playerIds) as { data: SubRow[] | null }
    if (!subs || subs.length === 0) continue

    const subMap: Record<string, unknown> = {}
    subs.forEach(s => { subMap[s.player_id] = s.subscription })

    const scoringTeamName = ev.scoringTeam === 'home' ? ev.homeTeam : ev.awayTeam
    const title = `⚽ GOL DO ${scoringTeamName.toUpperCase()}!`
    const now = new Date().toISOString()
    const logEntries: { player_id: string; title: string; body: string; sent_at: string }[] = []

    await Promise.allSettled(picks.map(async (pick) => {
      const sub = subMap[pick.player_id]
      if (!sub) return
      if (pick.pick_home == null || pick.pick_away == null) return

      const factor = calcFactor(Number(pick.pick_home), Number(pick.pick_away), ev.scoreHome, ev.scoreAway)
      const pts    = FACTOR_PTS[factor]
      const label  = FACTOR_LABEL[factor]
      const body   = `${ev.homeTeam} ${ev.scoreHome}×${ev.scoreAway} ${ev.awayTeam}. Seu palpite: ${pick.pick_home}×${pick.pick_away} — ${label} (${pts} pts se terminar assim).`

      try {
        await webpush.sendNotification(
          sub as webpush.PushSubscription,
          JSON.stringify({ title, body, icon: '/icon-192.png', badge: '/icon-192.png' })
        )
        notified++
        logEntries.push({ player_id: pick.player_id, title, body, sent_at: now })
      } catch (err: unknown) {
        // Inscrição expirada/inválida — limpa, igual ao padrão usado no auto-notify
        if (err && typeof err === 'object' && 'statusCode' in err) {
          const e = err as { statusCode: number }
          if (e.statusCode === 410 || e.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('player_id', pick.player_id)
          }
        }
      }
    }))

    if (logEntries.length > 0) {
      await supabaseAdmin.from('notification_log').insert(logEntries)
      for (const pid of playerIds) {
        const { data: old } = await supabaseAdmin
          .from('notification_log').select('id').eq('player_id', pid)
          .order('sent_at', { ascending: false }).range(5, 100)
        if (old && old.length > 0) {
          await supabaseAdmin.from('notification_log').delete().in('id', old.map((r: { id: string }) => r.id))
        }
      }
    }
  }

  return { notified }
}
