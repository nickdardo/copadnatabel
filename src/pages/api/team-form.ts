// GET /api/team-form?team=Brasil
// Retorna a forma recente (últimos 5 jogos) de uma seleção.
// Usa cache no Supabase (tabela team_form_cache) por 6 horas para economizar
// a cota diária da API-Football (100 requisições/dia no plano grátis).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { findTeamId, getRecentForm } from '@/lib/footballApi'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CACHE_HOURS = 6

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const team = (req.query.team as string || '').trim()
  if (!team) return res.status(400).json({ error: 'parâmetro team é obrigatório' })

  // 1. Tenta usar cache fresco
  const { data: cached } = await admin
    .from('team_form_cache')
    .select('*')
    .eq('team_name', team)
    .maybeSingle()

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.updated_at).getTime()) / 3_600_000
    if (ageHours < CACHE_HOURS) {
      return res.json({ ok: true, source: 'cache', team, recent: cached.recent_form || [] })
    }
  }

  // 2. Cache ausente ou expirado — busca na API externa
  if (!process.env.FOOTBALL_API_KEY) {
    // Sem chave configurada: devolve o cache antigo se existir, senão vazio
    if (cached) return res.json({ ok: true, source: 'cache-stale', team, recent: cached.recent_form || [] })
    return res.json({ ok: true, source: 'unavailable', team, recent: [] })
  }

  const teamInfo = await findTeamId(team)
  if (!teamInfo) {
    // Time não encontrado na API externa — não trava o usuário, devolve vazio
    if (cached) return res.json({ ok: true, source: 'cache-stale', team, recent: cached.recent_form || [] })
    return res.json({ ok: true, source: 'not-found', team, recent: [] })
  }

  const recent = await getRecentForm(teamInfo.id, 5)

  // 3. Atualiza o cache (upsert) para a próxima consulta não gastar cota de novo
  await admin.from('team_form_cache').upsert({
    team_name: team,
    api_team_id: teamInfo.id,
    recent_form: recent,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'team_name' })

  return res.json({ ok: true, source: 'live', team, recent })
}
