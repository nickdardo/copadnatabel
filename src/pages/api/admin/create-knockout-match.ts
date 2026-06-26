// POST /api/admin/create-knockout-match
// Cadastra manualmente um confronto de fase eliminatória (Dezesseis Avos,
// Oitavas, Quartas, Semifinais ou Final) quando a Odds API ainda não
// publicou esse jogo. odds_event_id fica null de propósito — é o que
// diferencia um confronto manual de um sincronizado, e o que permite
// removê-lo depois com segurança (delete-knockout-match.ts só apaga
// confrontos com odds_event_id null).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'cookie'
import { getFlag } from '@/lib/flags'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COOKIE_NAME = 'bolao_session'
const KNOCKOUT_PHASES = ['Dezesseis Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinais', 'Terceiro Lugar', 'Final']

async function getSessionAdmin(req: NextApiRequest): Promise<{ id: string } | null> {
  const cookies = parse(req.headers.cookie || '')
  const token = cookies[COOKIE_NAME]
  if (!token) return null

  const { data: session } = await admin
    .from('session_tokens')
    .select('player_id, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!session || new Date(session.expires_at) < new Date()) return null

  const { data: player } = await admin
    .from('players')
    .select('id, is_admin')
    .eq('id', session.player_id)
    .maybeSingle()
  if (!player || !player.is_admin) return null

  return { id: player.id }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const caller = await getSessionAdmin(req)
  if (!caller) return res.status(401).json({ error: 'Apenas administradores podem usar esta ferramenta.' })

  const { fase, home_team, away_team, bracket_side, match_date, official_match_number } = req.body
  if (!fase || !home_team || !away_team || home_team === away_team) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes ou inválidos.' })
  }
  if (!KNOCKOUT_PHASES.includes(fase)) {
    return res.status(400).json({ error: 'Fase inválida.' })
  }
  if (fase !== 'Final' && fase !== 'Terceiro Lugar' && bracket_side !== 'A' && bracket_side !== 'B') {
    return res.status(400).json({ error: 'Escolha o lado A ou B (exceto na Final/3º lugar).' })
  }

  const sortOrder = match_date
    ? Math.floor(new Date(match_date).getTime() / 1000)
    : Math.floor(Date.now() / 1000)

  const { error } = await admin.from('matches').insert({
    home_team, away_team,
    home_flag: getFlag(home_team), away_flag: getFlag(away_team),
    fase,
    bracket_side: (fase === 'Final' || fase === 'Terceiro Lugar') ? null : bracket_side,
    match_date: match_date || null,
    status: 'upcoming',
    score_home: null, score_away: null,
    sort_order: sortOrder,
    odds_event_id: null,
    official_match_number: official_match_number || null,
  })
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true })
}
