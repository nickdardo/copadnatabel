// POST /api/admin/finish-match
// Finaliza manualmente um jogo "ao vivo" com o placar já registrado, e aplica
// o palpite automático (0×0, com 50% dos pontos) para quem esqueceu de
// palpitar — mesma rotina que o sync automático dispara quando a Odds API
// confirma o fim do jogo.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'cookie'
import { applyAutoPicksForMatch } from '@/lib/autoPicks'

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
  if (!match_id) return res.status(400).json({ error: 'match_id é obrigatório.' })

  const { data: match } = await admin.from('matches').select('id, status, score_home, score_away').eq('id', match_id).maybeSingle()
  if (!match) return res.status(404).json({ error: 'Jogo não encontrado.' })
  if (match.score_home == null || match.score_away == null) {
    return res.status(400).json({ error: 'Edite e salve o placar final antes de finalizar este jogo.' })
  }

  const wasAlreadyDone = match.status === 'done'
  if (!wasAlreadyDone) {
    const { error } = await admin.from('matches').update({ status: 'done' }).eq('id', match_id)
    if (error) return res.status(500).json({ error: error.message })
  }

  let autoApplied = 0
  if (!wasAlreadyDone) {
    const result = await applyAutoPicksForMatch(match_id)
    autoApplied = result.inserted
    // Recálculo do ranking continua manual, por decisão do admin — os picks
    // automáticos já ficam criados e contam na próxima vez que ele recalcular.
  }

  return res.json({ ok: true, autoApplied })
}
