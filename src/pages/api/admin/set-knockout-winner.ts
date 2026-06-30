// POST /api/admin/set-knockout-winner
// Define manualmente quem avançou de verdade num jogo decidido na
// prorrogação/pênaltis — separado do placar de 90min usado pra pontuação.
// Necessário pra jogos que terminaram antes da correção que captura isso
// automaticamente (lib/footballDataSync.ts), ou em caso de qualquer
// divergência que precise de ajuste manual.
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

  const { match_id, knockout_winner } = req.body
  if (!match_id || (knockout_winner !== 'home' && knockout_winner !== 'away' && knockout_winner !== null)) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes ou inválidos.' })
  }

  const { error } = await admin.from('matches').update({ knockout_winner }).eq('id', match_id)
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true })
}
