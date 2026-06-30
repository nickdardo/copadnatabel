// Sincronização "de lupa" com o football-data.org — roda só durante a
// janela apertada de cada jogo (10min antes do início até 100min depois,
// cobrindo os 90 minutos + acréscimos). Pensada pra ser chamada a cada
// 1 minuto por um cron externo (cron-job.org), sem depender do navegador
// do admin estar aberto.
//
// Duas funções nessa janela que a Odds API não cobre bem:
// 1. Notificação de gol mais precisa (intervalo menor = aviso mais rápido).
// 2. Resolve a regra "vale só os 90 minutos" automaticamente — o
//    football-data.org informa explicitamente se o jogo foi à prorrogação
//    (score.duration) e qual era o placar exato nos 90 minutos
//    (score.regularTime), sem precisar de correção manual no admin.
import { createClient } from '@supabase/supabase-js'
import { translateTeam } from '@/lib/oddsSync'
import type { GoalEvent } from '@/lib/oddsSync'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FD_BASE = 'https://api.football-data.org/v4'
const WINDOW_BEFORE_MIN = 10   // começa a olhar 10min antes do jogo
const WINDOW_AFTER_MIN  = 100  // continua olhando até 100min depois do início

type FDScore = {
  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'
  fullTime: { home: number | null; away: number | null }
  regularTime?: { home: number | null; away: number | null }
}
type FDMatch = {
  id: number
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED'
  utcDate: string
  homeTeam: { name: string }
  awayTeam: { name: string }
  score: FDScore
}

type MatchRow = {
  id: string; home_team: string; away_team: string
  score_home: number | null; score_away: number | null
  status: string; match_date: string | null
}

export type TightSyncResult = {
  checked: number
  updated: number
  goalEvents: GoalEvent[]
  correctedExtraTime: number
  error?: string
}

export async function syncTightWindow(): Promise<TightSyncResult> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) return { checked: 0, updated: 0, goalEvents: [], correctedExtraTime: 0, error: 'FOOTBALL_DATA_API_KEY not set' }

  const now = Date.now()
  const windowStart = new Date(now - WINDOW_AFTER_MIN * 60_000).toISOString()
  const windowEnd   = new Date(now + WINDOW_BEFORE_MIN * 60_000).toISOString()

  // 1) Só busca na própria base — se não tem nenhum jogo na janela agora,
  // nem chama o football-data.org (economiza cota o resto do dia).
  //
  // IMPORTANTE: jogos já marcados 'live' são incluídos SEMPRE, sem limite
  // de tempo — não só os iniciados dentro da janela de 100min. Isso
  // corrige um bug real: jogos que vão à prorrogação/pênaltis (mata-mata)
  // facilmente passam de 150-180min do apito inicial até o fim de verdade,
  // bem além da janela de 100min pensada pra um jogo "normal". Sem essa
  // condição extra, o sync simplesmente parava de checar o jogo no meio da
  // prorrogação e ele nunca era marcado como encerrado sozinho.
  const { data: candidates } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, score_home, score_away, status, match_date')
    .or(`status.eq.live,and(status.eq.upcoming,match_date.gte.${windowStart},match_date.lte.${windowEnd})`)

  const rows = (candidates || []) as MatchRow[]
  if (rows.length === 0) return { checked: 0, updated: 0, goalEvents: [], correctedExtraTime: 0 }

  // 2) Busca os jogos da Copa do football-data.org num intervalo de datas
  // que cobre essa janela (1 chamada só, não importa quantos jogos estão
  // na janela ao mesmo tempo).
  const dateFrom = new Date(now - 1 * 24 * 60 * 60_000).toISOString().slice(0, 10)
  const dateTo   = new Date(now + 1 * 24 * 60 * 60_000).toISOString().slice(0, 10)
  const res = await fetch(`${FD_BASE}/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: { 'X-Auth-Token': apiKey },
  })
  if (!res.ok) return { checked: rows.length, updated: 0, goalEvents: [], correctedExtraTime: 0, error: `football-data.org: ${await res.text()}` }

  const data: { matches: FDMatch[] } = await res.json()
  const fdMatches = data.matches || []

  let updated = 0
  let correctedExtraTime = 0
  const goalEvents: GoalEvent[] = []

  for (const row of rows) {
    const fd = fdMatches.find(m => {
      const h = translateTeam(m.homeTeam.name)
      const a = translateTeam(m.awayTeam.name)
      return (h === row.home_team && a === row.away_team) || (h === row.away_team && a === row.home_team)
    })
    if (!fd) continue

    // Descobre se o time da casa no football-data.org é o mesmo "home" do
    // nosso banco (podem estar invertidos dependendo da fonte original).
    const fdHomeIsOurHome = translateTeam(fd.homeTeam.name) === row.home_team

    let newScoreHome = fdHomeIsOurHome ? fd.score.fullTime.home : fd.score.fullTime.away
    let newScoreAway = fdHomeIsOurHome ? fd.score.fullTime.away : fd.score.fullTime.home

    // Jogo terminou na prorrogação ou nos pênaltis — vale só os 90 minutos,
    // por decisão do bolão. Troca pelo placar regulamentar automaticamente.
    let wasCorrected = false
    if (fd.status === 'FINISHED' && fd.score.duration !== 'REGULAR' && fd.score.regularTime) {
      newScoreHome = fdHomeIsOurHome ? fd.score.regularTime.home : fd.score.regularTime.away
      newScoreAway = fdHomeIsOurHome ? fd.score.regularTime.away : fd.score.regularTime.home
      wasCorrected = true
    }

    if (newScoreHome == null || newScoreAway == null) continue

    const newStatus = fd.status === 'FINISHED' ? 'done' : (fd.status === 'IN_PLAY' || fd.status === 'PAUSED' ? 'live' : row.status)

    const scoreChanged = newScoreHome !== row.score_home || newScoreAway !== row.score_away
    const statusChanged = newStatus !== row.status
    if (!scoreChanged && !statusChanged) continue

    // Detecta gol — mesma regra do oddsSync.ts: jogo já estava "live" antes
    // e o placar subiu (não é o 0x0 do apito inicial).
    if (row.status === 'live' && newStatus === 'live' &&
        row.score_home !== null && row.score_away !== null &&
        (newScoreHome > row.score_home || newScoreAway > row.score_away)) {
      goalEvents.push({
        matchId: row.id, homeTeam: row.home_team, awayTeam: row.away_team,
        scoreHome: newScoreHome, scoreAway: newScoreAway,
        scoringTeam: newScoreHome > row.score_home ? 'home' : 'away',
      })
    }

    await supabaseAdmin.from('matches').update({
      score_home: newScoreHome, score_away: newScoreAway, status: newStatus,
    }).eq('id', row.id)

    updated++
    if (wasCorrected) correctedExtraTime++
  }

  return { checked: rows.length, updated, goalEvents, correctedExtraTime }
}
