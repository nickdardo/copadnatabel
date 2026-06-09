import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const BADGE_DEFS: Record<string, { label: string; desc: string }> = {
  placar_perfeito:   { label: 'Placar Perfeito',   desc: 'Acertou o placar exato pela primeira vez' },
  atirador_de_elite: { label: 'Atirador de Elite', desc: 'Acertou 5 placares exatos no total' },
  vidente:           { label: 'Vidente',            desc: 'Acertou 3 placares exatos consecutivos' },
  zebra:             { label: 'Zebra',              desc: 'Acertou resultado que menos de 20% apostou' },
  maratonista:       { label: 'Maratonista',        desc: 'Palpitou em todos os jogos de uma fase' },
  lider:             { label: 'Lider',              desc: 'Ficou em 1º lugar no ranking' },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Load all players, scores, picks and matches
  const [
    { data: players },
    { data: scores },
    { data: picks },
    { data: matches },
    { data: existingBadges },
  ] = await Promise.all([
    admin.from('players').select('id, username, nickname').eq('is_admin', false),
    admin.from('scores').select('*'),
    admin.from('picks').select('*'),
    admin.from('matches').select('id, fase, status, score_home, score_away').eq('status', 'done'),
    admin.from('player_badges').select('player_id, badge_key'),
  ])

  if (!players || !scores || !picks || !matches) return res.status(500).json({ error: 'DB error' })

  const scoreMap: Record<string, typeof scores[0]> = {}
  scores.forEach(s => { scoreMap[s.player_id] = s })

  const existingSet = new Set((existingBadges || []).map((b: { player_id: string; badge_key: string }) => `${b.player_id}:${b.badge_key}`))

  const toInsert: { player_id: string; badge_key: string }[] = []
  const newBadgeEvents: { player_id: string; player_name: string; badge_key: string }[] = []

  // Find current leader
  const sorted = [...scores].sort((a, b) => b.total_pts - a.total_pts)
  const leaderId = sorted[0]?.player_id

  for (const p of players) {
    const sc = scoreMap[p.id]
    if (!sc) continue

    const playerPicks = picks.filter((pk: { player_id: string }) => pk.player_id === p.id)
    const name = p.nickname || p.username

    function grantIfNew(key: string) {
      if (!existingSet.has(`${p.id}:${key}`)) {
        toInsert.push({ player_id: p.id, badge_key: key })
        newBadgeEvents.push({ player_id: p.id, player_name: name, badge_key: key })
      }
    }

    // Placar Perfeito — first F10
    if (sc.f10_count >= 1) grantIfNew('placar_perfeito')

    // Atirador de Elite — 5 F10
    if (sc.f10_count >= 5) grantIfNew('atirador_de_elite')

    // Vidente — 3 F10 consecutive (ordered by match sort_order)
    const donePicks = playerPicks
      .filter((pk: { match_id: string; pick_home: number; pick_away: number }) => {
        const m = matches.find(m => m.id === pk.match_id)
        return m && m.status === 'done' && m.score_home != null
      })
      .sort((a: { match_id: string }, b: { match_id: string }) => {
        const ma = matches.find(m => m.id === a.match_id)
        const mb = matches.find(m => m.id === b.match_id)
        return (ma as { sort_order?: number })?.sort_order || 0 - ((mb as { sort_order?: number })?.sort_order || 0)
      })

    let consecutive = 0
    for (const pk of donePicks as { match_id: string; pick_home: number; pick_away: number }[]) {
      const m = matches.find(m => m.id === pk.match_id)
      if (!m) continue
      if (pk.pick_home === m.score_home && pk.pick_away === m.score_away) {
        consecutive++
        if (consecutive >= 3) { grantIfNew('vidente'); break }
      } else {
        consecutive = 0
      }
    }

    // Maratonista — picked all matches of any fase
    const phases = [...new Set(matches.map(m => m.fase))]
    for (const fase of phases) {
      const faseMatches = matches.filter(m => m.fase === fase)
      const fasePicks   = playerPicks.filter((pk: { match_id: string }) => faseMatches.some(m => m.id === pk.match_id))
      if (fasePicks.length >= faseMatches.length && faseMatches.length > 0) {
        grantIfNew('maratonista')
        break
      }
    }

    // Lider
    if (p.id === leaderId) grantIfNew('lider')

    // Zebra — acertou resultado que menos de 20% apostou
    for (const pk of donePicks as { match_id: string; pick_home: number; pick_away: number }[]) {
      const m = matches.find(m => m.id === pk.match_id)
      if (!m || m.score_home == null) continue
      const result = m.score_home > m.score_away ? 'H' : m.score_home < m.score_away ? 'A' : 'D'
      const playerResult = pk.pick_home > pk.pick_away ? 'H' : pk.pick_home < pk.pick_away ? 'A' : 'D'
      if (result !== playerResult) continue
      // Check how many players bet this result
      const matchPicks = picks.filter((p2: { match_id: string }) => p2.match_id === m.id)
      const sameResult = matchPicks.filter((p2: { pick_home: number; pick_away: number }) => {
        const r2 = p2.pick_home > p2.pick_away ? 'H' : p2.pick_home < p2.pick_away ? 'A' : 'D'
        return r2 === result
      })
      if (matchPicks.length > 0 && sameResult.length / matchPicks.length < 0.2) {
        grantIfNew('zebra')
        break
      }
    }
  }

  // Insert new badges
  if (toInsert.length > 0) {
    await admin.from('player_badges').insert(toInsert)

    // Create feed events for new badges
    const feedEvents = newBadgeEvents.map(e => ({
      type: 'badge_earned',
      player_id: e.player_id,
      player_name: e.player_name,
      badge_key: e.badge_key,
    }))
    if (feedEvents.length > 0) {
      await admin.from('activity_feed').insert(feedEvents)
    }
  }

  return res.json({ ok: true, granted: toInsert.length, badges: toInsert })
}
