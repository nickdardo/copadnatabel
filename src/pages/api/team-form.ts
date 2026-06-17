// GET /api/team-form?team=Brasil
// Retorna a forma recente (últimos 5 jogos) de uma seleção, calculada 100%
// a partir dos jogos da Copa 2026 já registrados no nosso próprio banco
// (tabela matches, status='done'). Não depende de nenhuma API externa —
// assim que o admin salva o resultado de um jogo, ele já entra na forma
// recente de ambas as seleções automaticamente.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type RecentResult = {
  date: string
  opponent: string
  goalsFor: number
  goalsAgainst: number
  result: 'V' | 'E' | 'D'
  competition: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const team = (req.query.team as string || '').trim()
  if (!team) return res.status(400).json({ error: 'parâmetro team é obrigatório' })

  // Busca todos os jogos já encerrados em que a seleção jogou, como home ou away
  const { data: matches, error } = await admin
    .from('matches')
    .select('home_team, away_team, score_home, score_away, match_date, fase')
    .eq('status', 'done')
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .order('match_date', { ascending: false })
    .limit(5)

  if (error) return res.status(500).json({ error: error.message })

  const recent: RecentResult[] = (matches || [])
    .filter(m => m.score_home != null && m.score_away != null)
    .map(m => {
      const isHome = m.home_team === team
      const goalsFor = isHome ? m.score_home! : m.score_away!
      const goalsAgainst = isHome ? m.score_away! : m.score_home!
      const opponent = isHome ? m.away_team : m.home_team
      let result: 'V' | 'E' | 'D' = 'E'
      if (goalsFor > goalsAgainst) result = 'V'
      else if (goalsFor < goalsAgainst) result = 'D'
      return {
        date: m.match_date || '',
        opponent,
        goalsFor,
        goalsAgainst,
        result,
        competition: m.fase || 'Copa 2026',
      }
    })

  return res.json({ ok: true, source: 'database', team, recent })
}
