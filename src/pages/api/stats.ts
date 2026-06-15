// GET /api/stats — Estatísticas gerais do bolão
// Returns: championStats, mostPopularScore, riskyBets, accuracy
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

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const [
      { data: champRows },
      { data: picksRows },
      { data: doneMatches },
      { data: scoresRows },
      { data: players },
    ] = await Promise.all([
      admin.from('champion_picks').select('pick_champion'),
      admin.from('picks').select('player_id, match_id, pick_home, pick_away'),
      admin.from('matches').select('id, score_home, score_away').eq('status', 'done').not('score_home', 'is', null),
      admin.from('scores').select('player_id, f10_count, f7_count, f5_count, f2_count, f0_count, picks_count'),
      admin.from('players').select('id, nickname, username').eq('payment_ok', true),
    ])

    // ── 1. Champion picks ──────────────────────────────────────────────
    const champCounts: Record<string, number> = {}
    for (const r of (champRows || [])) {
      if (r.pick_champion) champCounts[r.pick_champion] = (champCounts[r.pick_champion] || 0) + 1
    }
    const totalChamp = Object.values(champCounts).reduce((a, b) => a + b, 0)
    const champSorted = Object.entries(champCounts)
      .map(([team, count]) => ({ team, count, pct: totalChamp > 0 ? Math.round((count / totalChamp) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    // Top 3 most bet
    const championStats = champSorted.slice(0, 3)

    // "Apostas de risco": selections with ≤5% that at least 1 person picked, exclude top 3
    const riskyBets = champSorted
      .filter(c => c.pct <= 5 && c.count >= 1)
      .slice(0, 5)

    // ── 2. Most popular score across all picks (done matches) ──────────
    const doneIds = new Set((doneMatches || []).map(m => m.id))
    const scoreCounts: Record<string, number> = {}
    let totalDonePicks = 0
    for (const p of (picksRows || [])) {
      if (!doneIds.has(p.match_id)) continue
      const key = `${p.pick_home}×${p.pick_away}`
      scoreCounts[key] = (scoreCounts[key] || 0) + 1
      totalDonePicks++
    }
    const topScore = Object.entries(scoreCounts)
      .sort((a, b) => b[1] - a[1])[0]
    const mostPopularScore = topScore
      ? { score: topScore[0], count: topScore[1], pct: totalDonePicks > 0 ? Math.round((topScore[1] / totalDonePicks) * 100) : 0 }
      : null

    // ── 3. Accuracy stats ──────────────────────────────────────────────
    const playerMap = Object.fromEntries((players || []).map(p => [p.id, p]))
    let totalHits = 0, totalPicks = 0

    interface AccRow { player_id: string; acc: number; picks: number }
    const accRows: AccRow[] = []

    for (const s of (scoresRows || [])) {
      if (!playerMap[s.player_id]) continue
      const hits  = (s.f10_count || 0) + (s.f7_count || 0) + (s.f5_count || 0)
      const total = s.picks_count || 0
      if (total === 0) continue
      totalHits  += hits
      totalPicks += total
      accRows.push({ player_id: s.player_id, acc: Math.round((hits / total) * 100), picks: total })
    }

    const avgAccuracy = totalPicks > 0 ? Math.round((totalHits / totalPicks) * 100) : 0

    // Need at least 3 picks to qualify
    const qualified = accRows.filter(r => r.picks >= 3).sort((a, b) => b.acc - a.acc)
    const best  = qualified[0]
    const worst = qualified[qualified.length - 1]

    const accuracy = {
      avg: avgAccuracy,
      best:  best  ? { name: playerMap[best.player_id]?.nickname  || playerMap[best.player_id]?.username  || '?', pct: best.acc  } : null,
      worst: worst ? { name: playerMap[worst.player_id]?.nickname || playerMap[worst.player_id]?.username || '?', pct: worst.acc } : null,
    }

    // ── 4. Average F10 per player ──────────────────────────────────────
    const avgF10 = scoresRows && scoresRows.length > 0
      ? +(Object.values(scoresRows).reduce((sum, s) => sum + (s.f10_count || 0), 0) / scoresRows.length).toFixed(1)
      : 0

    return res.json({ championStats, riskyBets, mostPopularScore, accuracy, avgF10, totalChamp })
  } catch (err) {
    console.error('stats error:', err)
    return res.status(500).json({ error: 'internal' })
  }
}
