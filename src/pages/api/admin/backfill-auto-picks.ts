// POST /api/admin/backfill-auto-picks
// Aplica retroativamente o palpite automático (0×0, 50% dos pontos) em TODOS
// os jogos já encerrados, para jogadores que nunca palpitaram neles. Útil na
// primeira execução depois de habilitar esta funcionalidade, já que jogos
// encerrados antes dela existir nunca passaram por essa rotina.
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

  const { data: doneMatches, error } = await admin
    .from('matches')
    .select('id')
    .eq('status', 'done')
    .not('score_home', 'is', null)
    .not('score_away', 'is', null)
  if (error) return res.status(500).json({ error: error.message })

  let totalApplied = 0
  for (const m of doneMatches || []) {
    const result = await applyAutoPicksForMatch(m.id)
    totalApplied += result.inserted
  }

  return res.json({ ok: true, matchesChecked: (doneMatches || []).length, totalApplied })
}
