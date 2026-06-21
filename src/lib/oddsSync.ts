import { createClient } from '@supabase/supabase-js'
import { getFlag } from '@/lib/flags'
import { applyAutoPicksForMatch } from '@/lib/autoPicks'

const ODDS_BASE = 'https://api.the-odds-api.com/v4'
const SPORT_KEY = 'soccer_fifa_world_cup'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// EN → PT name translation map
const EN_TO_PT: Record<string, string> = {
  'Albania':'Albania','Germany':'Alemanha','Argentina':'Argentina',
  'Saudi Arabia':'Arábia Saudita','Australia':'Austrália','Austria':'Áustria',
  'Belgium':'Bélgica','Bolivia':'Bolívia','Brazil':'Brasil','Cameroon':'Camarões',
  'Canada':'Canadá','Kazakhstan':'Cazaquistão','Chile':'Chile','Colombia':'Colômbia',
  'South Korea':'Coreia do Sul','Korea Republic':'Coreia do Sul',
  'Costa Rica':'Costa Rica','Croatia':'Croácia','Denmark':'Dinamarca',
  'Ecuador':'Equador','Slovakia':'Eslováquia','Slovenia':'Eslovênia',
  'Spain':'Espanha','United States':'Estados Unidos','USA':'Estados Unidos',
  'France':'França','Georgia':'Geórgia','Honduras':'Honduras','Hungary':'Hungria',
  'England':'Inglaterra','Iran':'Irã','Iraq':'Iraque','Israel':'Israel',
  'Italy':'Itália','Jamaica':'Jamaica','Japan':'Japão','Morocco':'Marrocos',
  'Mexico':'México','Mozambique':'Moçambique','Nigeria':'Nigéria',
  'Norway':'Noruega','New Zealand':'Nova Zelândia','Netherlands':'Países Baixos',
  'Panama':'Panamá','Paraguay':'Paraguai','Peru':'Peru','Portugal':'Portugal',
  'DR Congo':'RD Congo','Congo DR':'RD Congo','Romania':'Romênia',
  'Serbia':'Sérvia','Senegal':'Senegal','Sweden':'Suécia',
  'Switzerland':'Suíça','Czech Republic':'Tchéquia','Czechia':'Tchéquia',
  'Turkey':'Turquia','Turkiye':'Turquia','Uruguay':'Uruguai','Venezuela':'Venezuela',
  'Wales':'País de Gales','Scotland':'Escócia','Poland':'Polônia',
  "Ivory Coast":"Costa do Marfim","Cote d'Ivoire":"Costa do Marfim",
  'Ghana':'Gana','Tunisia':'Tunísia','Algeria':'Argélia','Egypt':'Egito',
  'Indonesia':'Indonésia','Qatar':'Qatar','South Africa':'África do Sul',
  'Trinidad and Tobago':'Trinidad e Tobago','El Salvador':'El Salvador',
  'Cuba':'Cuba','Guatemala':'Guatemala','Haiti':'Haiti',
}

function translateTeam(enName: string): string {
  return EN_TO_PT[enName] || enName
}

function detectPhase(commenceTime: string): string {
  const ts = new Date(commenceTime).getTime()
  // Copa 2026: 48 teams, 12 groups
  // Group stage: Jun 11–25
  // Round of 32: Jun 27–Jul 3
  // Round of 16 (Oitavas): Jul 4–7
  // Quarterfinals: Jul 9–11
  // Semifinals: Jul 14–15
  // Third place: Jul 18
  // Final: Jul 19
  if (ts < new Date('2026-06-27T00:00:00Z').getTime()) return 'Fase de Grupos'
  if (ts < new Date('2026-07-04T00:00:00Z').getTime()) return 'Oitavas de Final'
  if (ts < new Date('2026-07-09T00:00:00Z').getTime()) return 'Quartas de Final'
  if (ts < new Date('2026-07-14T00:00:00Z').getTime()) return 'Semifinais'
  if (ts < new Date('2026-07-19T00:00:00Z').getTime()) return 'Terceiro Lugar'
  return 'Final'
}

type OddsEvent = { id:string; home_team:string; away_team:string; commence_time:string }
type OddsScore = OddsEvent & { completed:boolean; scores: Array<{name:string;score:string}>|null }
export type SyncResult = { synced:number; updated:number; recalculated:boolean; quotaRemaining:number|null; error?:string }

export async function syncFromOddsAPI(): Promise<SyncResult> {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) return { synced:0, updated:0, recalculated:false, quotaRemaining:null, error:'ODDS_API_KEY not set' }

  let quotaRemaining: number | null = null

  try {
    const eventsRes = await fetch(
      `${ODDS_BASE}/sports/${SPORT_KEY}/events?apiKey=${apiKey}&dateFormat=iso`,
      { cache: 'no-store' }
    )
    quotaRemaining = Number(eventsRes.headers.get('x-requests-remaining') ?? null)
    if (!eventsRes.ok) return { synced:0, updated:0, recalculated:false, quotaRemaining, error:`Events: ${await eventsRes.text()}` }
    const events: OddsEvent[] = await eventsRes.json()

    const scoresRes = await fetch(
      `${ODDS_BASE}/sports/${SPORT_KEY}/scores?apiKey=${apiKey}&daysFrom=3&dateFormat=iso`,
      { cache: 'no-store' }
    )
    quotaRemaining = Number(scoresRes.headers.get('x-requests-remaining') ?? quotaRemaining)
    const scoresMap: Record<string, OddsScore> = {}
    if (scoresRes.ok) {
      const sd: OddsScore[] = await scoresRes.json()
      sd.forEach(s => { scoresMap[s.id] = s })
    }

    const { data: existingRows } = await supabaseAdmin
      .from('matches').select('id, odds_event_id, status, score_home, score_away')
    const existingMap: Record<string, any> = {}
    ;(existingRows || []).forEach((m: any) => { if (m.odds_event_id) existingMap[m.odds_event_id] = m })

    let synced=0, updated=0, hasNewResults=false
    const now = Date.now()

    for (const ev of events) {
      const score    = scoresMap[ev.id]
      const existing = existingMap[ev.id]

      // Translate team names EN → PT
      const homeTeamPT = translateTeam(ev.home_team)
      const awayTeamPT = translateTeam(ev.away_team)
      const homeFlag   = getFlag(homeTeamPT)
      const awayFlag   = getFlag(awayTeamPT)

      let scoreHome: number|null = null
      let scoreAway: number|null = null
      if (score?.scores) {
        const h = score.scores.find(s => s.name === ev.home_team)
        const a = score.scores.find(s => s.name === ev.away_team)
        if (h) scoreHome = parseInt(h.score, 10)
        if (a) scoreAway = parseInt(a.score, 10)
      }

      const commenceMs = new Date(ev.commence_time).getTime()
      const minsSince  = (now - commenceMs) / 60000
      let status: 'upcoming'|'live'|'done'
      if (score?.completed)                       status = 'done'
      else if (minsSince>=0 && minsSince<150)     status = 'live'
      else if (commenceMs > now)                  status = 'upcoming'
      else                                        status = 'live'

      // Uma vez encerrado, nunca reverte sozinho — nem se a Odds API ainda não
      // confirmou completed=true. Isso evita desfazer uma finalização manual
      // do admin (ou um 'done' anterior) só porque a API está atrasada para
      // confirmar o fim da partida. Só um Reset manual no painel reabre o jogo.
      if (existing?.status === 'done') status = 'done'

      const matchData = {
        odds_event_id: ev.id,
        home_team:  homeTeamPT,
        away_team:  awayTeamPT,
        home_flag:  homeFlag,
        away_flag:  awayFlag,
        match_date: ev.commence_time,
        fase:       detectPhase(ev.commence_time),
        status, score_home: scoreHome, score_away: scoreAway,
        sort_order: Math.floor(commenceMs / 1000),
      }

      if (!existing) {
        const { error } = await supabaseAdmin.from('matches').insert(matchData)
        if (!error) synced++
      } else {
        const changed = existing.status !== status
          || existing.score_home !== scoreHome
          || existing.score_away !== scoreAway
          || (scoreHome !== null && existing.score_home === null)
          || (scoreAway !== null && existing.score_away === null)
        if (changed) {
          const { error } = await supabaseAdmin.from('matches').update(matchData).eq('odds_event_id', ev.id)
          if (!error) {
            updated++
            if (status === 'done' && existing.status !== 'done') {
              hasNewResults = true
              // Quem esqueceu de palpitar nesse jogo recebe automaticamente
              // um palpite de 0×0 (com 50% dos pontos que isso renderia) —
              // ver lib/autoPicks.ts e a regra em v1.16_palpite_automatico.sql
              await applyAutoPicksForMatch(existing.id)
            }
          }
        }
      }
    }

    let recalculated = false
    if (hasNewResults) {
      const { error } = await supabaseAdmin.rpc('recalc_all_scores')
      recalculated = !error
    }

    return { synced, updated, recalculated, quotaRemaining }
  } catch (err: any) {
    return { synced:0, updated:0, recalculated:false, quotaRemaining, error: err.message }
  }
}
