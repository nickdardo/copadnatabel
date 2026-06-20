// POST /api/admin/fix-pick
// Permite ao admin corrigir manualmente o palpite de UM jogador em UM jogo
// específico, mesmo que o jogo já esteja travado, ao vivo ou encerrado.
// Usado para casos de bug/falha de salvamento — correção pontual, não uma
// liberação geral (ao contrário do toggle "Travamento dos jogos", que afeta
// todo o grupo).
//
// Diferente da maioria das rotas administrativas deste projeto, esta verifica
// de fato que quem está chamando é um admin autenticado, via cookie de sessão.
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

  const { player_id, match_id, pick_home, pick_away } = req.body
  if (!player_id || !match_id || pick_home == null || pick_away == null) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' })
  }
  const home = Number(pick_home)
  const away = Number(pick_away)
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return res.status(400).json({ error: 'Placar inválido.' })
  }

  const { error } = await admin.from('picks').upsert({
    player_id,
    match_id,
    pick_home: home,
    pick_away: away,
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'player_id,match_id' })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
}
