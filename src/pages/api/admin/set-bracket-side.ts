// POST /api/admin/set-bracket-side
// Salva o lado da chave (A ou B) de um confronto de mata-mata. Usado pelo
// BracketSideEditor no admin, pra classificar manualmente cada jogo das
// Dezesseis Avos / Oitavas / Quartas / Semifinais conforme eles forem
// aparecendo (sincronizados da Odds API ou cadastrados manualmente).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'cookie'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COOKIE_NAME = 'bolao_session'

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

  const { match_id, bracket_side, official_match_number } = req.body
  if (!match_id || (bracket_side !== 'A' && bracket_side !== 'B' && bracket_side !== null)) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes ou inválidos.' })
  }

  const update: { bracket_side: 'A' | 'B' | null; official_match_number?: number } = { bracket_side }
  if (official_match_number) update.official_match_number = official_match_number

  const { error } = await admin.from('matches').update(update).eq('id', match_id)
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true })
}
