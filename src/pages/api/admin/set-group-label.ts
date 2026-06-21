// POST /api/admin/set-group-label
// Salva a letra oficial (A-L) de um grupo, sobrescrevendo o palpite
// automático de ordenação alfabética. Recebe a lista de times daquele
// grupo (detectados automaticamente pelo agrupamento de confrontos) e a
// letra correta, e grava essa correspondência para os 4 times de uma vez.
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

  const { teams, group_label } = req.body
  if (!Array.isArray(teams) || teams.length === 0 || !group_label) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' })
  }

  const rows = teams.map((team: string) => ({ team_name: team, group_label }))
  const { error } = await admin.from('team_group_overrides').upsert(rows, { onConflict: 'team_name' })
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true })
}
