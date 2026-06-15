// GET /api/highlights
// Returns top 3 highlight cards for the Feed tab:
//   topDay    — player with highest pts from today's completed matches
//   exactScorers — players who got exact score (F10) in the most recent match
//   hotStreak    — player with longest current consecutive scoring streak (≥3)
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function calcFactor(pH: number, pA: number, rH: number, rA: number) {
  const pr = pH > pA ? 'H' : pH < pA ? 'A' : 'D'
  const rr = rH > rA ? 'H' : rH < rA ? 'A' : 'D'
  if (pH === rH && pA === rA) return 'F10'
  if (pr === rr && (pH === rH || pA === rA)) return 'F7'
  if (pr === rr) return 'F5'
  if (pH === rH || pA === rA) return 'F2'
  return 'F0'
}

const PTS: Record<string, number> = { F10: 10, F7: 7, F5: 5, F2: 2, F0: 0 }

function initials(name: string) {
  const parts = name.trim().split(' ')
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    // BRT boundaries for "today"
    const now = new Date()
    const brtOffset = -3 * 60
    const brtNow = new Date(now.getTime() + (brtOffset - now.getTimezoneOffset()) * 60000)
    const todayBRT = brtNow.toISOString().slice(0, 10)
    const todayStart = new Date(todayBRT + 'T00:00:00-03:00').toISOString()
    const todayEnd   = new Date(todayBRT + 'T23:59:59-03:00').toISOString()

    // ── Fetch done matches ───────────────────────────────────────────────
    const { data: allDone } = await admin
      .from('matches')
      .select('id, home_team, away_team, match_date, score_home, score_away')
      .eq('status', 'done')
      .not('score_home', 'is', null)
      .order('match_date', { ascending: false })

    if (!allDone || allDone.length === 0) {
      return res.json({ topDay: null, exactScorers: null, hotStreak: null })
    }

    // Today's done matches
    const todayDone = allDone.filter(
      m => m.match_date >= todayStart && m.match_date <= todayEnd
    )

    // ── Fetch all picks for done matches ────────────────────────────────
    const doneIds = allDone.map(m => m.id)
    const { data: allPicks } = await admin
      .from('picks')
      .select('player_id, match_id, pick_home, pick_away')
      .in('match_id', doneIds.slice(0, 200))   // cap for perf

    // ── Fetch players ────────────────────────────────────────────────────
    const { data: players } = await admin
      .from('players')
      .select('id, nickname, username, payment_ok')
      .eq('payment_ok', true)

    if (!allPicks || !players) {
      return res.json({ topDay: null, exactScorers: null, hotStreak: null })
    }

    const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
    const matchMap  = Object.fromEntries(allDone.map(m => [m.id, m]))
    const todayIds  = new Set(todayDone.map(m => m.id))

    // ── 1. Maior pontuação do dia ─────────────────────────────────────
    let topDay: { player_name: string; pts_today: number; games_today: number } | null = null
    if (todayDone.length > 0) {
      const dayPts: Record<string, { pts: number; games: number }> = {}
      for (const pick of allPicks) {
        if (!todayIds.has(pick.match_id)) continue
        const m = matchMap[pick.match_id]
        if (!m) continue
        const factor = calcFactor(pick.pick_home, pick.pick_away, m.score_home, m.score_away)
        if (!dayPts[pick.player_id]) dayPts[pick.player_id] = { pts: 0, games: 0 }
        dayPts[pick.player_id].pts   += PTS[factor]
        dayPts[pick.player_id].games += 1
      }
      const best = Object.entries(dayPts).sort((a, b) => b[1].pts - a[1].pts)[0]
      if (best && best[1].pts > 0) {
        const p = playerMap[best[0]]
        topDay = {
          player_name: p?.nickname || p?.username || 'Jogador',
          pts_today:   best[1].pts,
          games_today: best[1].games,
        }
      }
    }

    // ── 2. Placares exatos — jogo mais recente com ao menos 1 F10 ──────
    let exactScorers: {
      match_desc: string; score_desc: string
      players: { name: string; initials: string }[]
    } | null = null

    // Find the most recent done match that has at least one F10 pick
    for (const m of allDone) {
      const picksForMatch = allPicks.filter(p => p.match_id === m.id)
      const f10picks = picksForMatch.filter(p =>
        calcFactor(p.pick_home, p.pick_away, m.score_home, m.score_away) === 'F10'
      )
      if (f10picks.length > 0) {
        exactScorers = {
          match_desc:  `${m.home_team} × ${m.away_team}`,
          score_desc:  `${m.score_home}×${m.score_away}`,
          players: f10picks.slice(0, 8).map(p => {
            const pl = playerMap[p.player_id]
            const name = pl?.nickname || pl?.username || '?'
            return { name, initials: initials(name).toUpperCase() }
          }),
        }
        break
      }
    }

    // ── 3. Sequência em alta — maior streak de acertos consecutivos ─────
    let hotStreak: { player_name: string; streak: number } | null = null

    // Build per-player pick list sorted by match date ASC
    const byPlayer: Record<string, { date: string; pts: number }[]> = {}
    for (const pick of allPicks) {
      const m = matchMap[pick.match_id]
      if (!m) continue
      const factor = calcFactor(pick.pick_home, pick.pick_away, m.score_home, m.score_away)
      if (!byPlayer[pick.player_id]) byPlayer[pick.player_id] = []
      byPlayer[pick.player_id].push({ date: m.match_date || '', pts: PTS[factor] })
    }

    let bestStreak = 0
    let bestPlayerId = ''
    for (const [playerId, picks] of Object.entries(byPlayer)) {
      const sorted = picks.sort((a, b) => a.date.localeCompare(b.date))
      // Count current streak from most recent pick backwards
      let streak = 0
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].pts > 0) streak++
        else break
      }
      if (streak > bestStreak) { bestStreak = streak; bestPlayerId = playerId }
    }

    if (bestStreak >= 3 && bestPlayerId) {
      const p = playerMap[bestPlayerId]
      hotStreak = {
        player_name: p?.nickname || p?.username || 'Jogador',
        streak: bestStreak,
      }
    }

    return res.json({ topDay, exactScorers, hotStreak })
  } catch (err) {
    console.error('highlights error:', err)
    return res.status(500).json({ error: 'internal' })
  }
}
