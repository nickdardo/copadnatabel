import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const { match_id } = req.query
  if (!match_id) return res.status(400).json({ error: 'match_id required' })

  const { data: match } = await admin.from('matches').select('match_date, status').eq('id', match_id).single()
  if (!match) return res.status(404).json({ error: 'Match not found' })

  const lockTime = new Date(match.match_date).getTime() - 2 * 3600_000
  const isLocked = match.status === 'live' || match.status === 'done' || Date.now() >= lockTime
  if (!isLocked) return res.status(403).json({ error: 'Picks not yet revealed' })

  const { data: picks } = await admin.from('picks').select('player_id, pick_home, pick_away').eq('match_id', match_id)
  if (!picks?.length) return res.json({ ok: true, total: 0, distribution: [], winnerDist: { home: 0, draw: 0, away: 0 } })

  const playerIds = picks.map((p: { player_id: string }) => p.player_id)
  const [{ data: players }, { data: scores }] = await Promise.all([
    admin.from('players').select('id, nickname, username, avatar_url').in('id', playerIds),
    admin.from('scores').select('player_id, total_pts, rank_position').in('player_id', playerIds),
  ])

  const playerMap: Record<string, { nickname?: string; username: string; avatar_url?: string }> = {}
  ;(players || []).forEach((p: { id: string; nickname?: string; username: string; avatar_url?: string }) => { playerMap[p.id] = p })
  const scoreMap: Record<string, { total_pts: number; rank_position?: number }> = {}
  ;(scores || []).forEach((s: { player_id: string; total_pts: number; rank_position?: number }) => { scoreMap[s.player_id] = s })

  const distribution: Record<string, { home: number; away: number; count: number; players: { id: string; name: string; avatar?: string; rank?: number; pts: number }[] }> = {}
  picks.forEach((p: { player_id: string; pick_home: number; pick_away: number }) => {
    const key = `${p.pick_home}-${p.pick_away}`
    if (!distribution[key]) distribution[key] = { home: p.pick_home, away: p.pick_away, count: 0, players: [] }
    distribution[key].count++
    const pl = playerMap[p.player_id]
    const sc = scoreMap[p.player_id]
    if (pl) distribution[key].players.push({ id: p.player_id, name: pl.nickname || pl.username, avatar: pl.avatar_url, rank: sc?.rank_position, pts: sc?.total_pts || 0 })
  })
  Object.values(distribution).forEach(d => d.players.sort((a, b) => (a.rank || 999) - (b.rank || 999)))

  const sorted = Object.values(distribution).sort((a, b) => b.count - a.count)
  const winnerDist = { home: 0, draw: 0, away: 0 }
  picks.forEach((p: { pick_home: number; pick_away: number }) => {
    if (p.pick_home > p.pick_away) winnerDist.home++
    else if (p.pick_home < p.pick_away) winnerDist.away++
    else winnerDist.draw++
  })

  return res.json({ ok: true, total: picks.length, distribution: sorted, winnerDist })
}
