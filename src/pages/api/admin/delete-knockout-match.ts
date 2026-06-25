// POST /api/admin/delete-knockout-match
// Remove um confronto de mata-mata cadastrado manualmente (errado ou
// duplicado). Por segurança, só apaga linhas com odds_event_id null —
// um confronto que veio da Odds API nunca é removido por aqui, evitando
// apagar dados reais sincronizados por engano.
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

  const { match_id } = req.body
  if (!match_id) return res.status(400).json({ error: 'match_id ausente.' })

  const { data: existing } = await admin.from('matches').select('odds_event_id').eq('id', match_id).maybeSingle()
  if (!existing) return res.status(404).json({ error: 'Confronto não encontrado.' })
  if (existing.odds_event_id) {
    return res.status(400).json({ error: 'Este confronto veio da Odds API e não pode ser removido por aqui.' })
  }

  const { error } = await admin.from('matches').delete().eq('id', match_id)
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true })
}
