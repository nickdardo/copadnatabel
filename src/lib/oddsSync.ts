/**
 * The Odds API — sync service
 *
 * Endpoints:
 *   GET /v4/sports/soccer_fifa_world_cup/events  → fixtures (0 quota cost)
 *   GET /v4/sports/soccer_fifa_world_cup/scores  → live + finished scores (1 req/call)
 *
 * Copa 2026: sport_key = soccer_fifa_world_cup
 */

import { createClient } from '@supabase/supabase-js'

const ODDS_BASE = 'https://api.the-odds-api.com/v4'
const SPORT_KEY = 'soccer_fifa_world_cup'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Flag map (EN team names from The Odds API) ──────────────────────────────
const FLAG_MAP: Record<string, string> = {
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'France': '🇫🇷', 'Spain': '🇪🇸',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹', 'Germany': '🇩🇪',
  'Netherlands': '🇳🇱', 'Uruguay': '🇺🇾', 'Belgium': '🇧🇪',
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Korea Republic': '🇰🇷',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Colombia': '🇨🇴', 'Chile': '🇨🇱',
  'Ecuador': '🇪🇨', 'Denmark': '🇩🇰', 'Austria': '🇦🇹', 'Switzerland': '🇨🇭',
  'Croatia': '🇭🇷', 'Serbia': '🇷🇸', 'Romania': '🇷🇴', 'Slovenia': '🇸🇮',
  'Albania': '🇦🇱', 'Turkey': '🇹🇷', 'Kazakhstan': '🇰🇿', 'Georgia': '🇬🇪',
  'Italy': '🇮🇹', 'Saudi Arabia': '🇸🇦', 'Australia': '🇦🇺', 'Nigeria': '🇳🇬',
  'Cameroon': '🇨🇲', 'Czech Republic': '🇨🇿', 'Czechia': '🇨🇿',
  'Slovakia': '🇸🇰', 'Hungary': '🇭🇺', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
  'Israel': '🇮🇱', 'Iraq': '🇮🇶', 'Iran': '🇮🇷', 'New Zealand': '🇳🇿',
  'Mozambique': '🇲🇿', 'DR Congo': '🇨🇩', 'Congo DR': '🇨🇩',
  'South Africa': '🇿🇦', 'Peru': '🇵🇪', 'Bolivia': '🇧🇴', 'Venezuela': '🇻🇪',
  'Paraguay': '🇵🇾', 'Panama': '🇵🇦', 'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳',
  'Jamaica': '🇯🇲', 'Trinidad and Tobago': '🇹🇹', 'Qatar': '🇶🇦',
  'Indonesia': '🇮🇩', 'Bosnia and Herzegovina': '🇧🇦', 'Bosnia-Herzegovina': '🇧🇦',
  'Ukraine': '🇺🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Poland': '🇵🇱', 'Greece': '🇬🇷',
}
function getFlag(team: string) { return FLAG_MAP[team] || '🏳️' }

// ─── Copa 2026 phase detection by date ──────────────────────────────────────
function detectPhase(commenceTime: string): string {
  const ts = new Date(commenceTime).getTime()
  // Copa 2026: Jun 11 – Jul 19, 2026
  if (ts < new Date('2026-07-01T00:00:00Z').getTime()) return 'Fase de Grupos'
  if (ts < new Date('2026-07-07T00:00:00Z').getTime()) return 'Oitavas'
  if (ts < new Date('2026-07-12T00:00:00Z').getTime()) return 'Quartas'
  if (ts < new Date('2026-07-16T00:00:00Z').getTime()) return 'Semifinais'
  if (ts < new Date('2026-07-19T00:00:00Z').getTime()) return 'Terceiro Lugar'
  return 'Final'
}

// ─── Types ───────────────────────────────────────────────────────────────────
type OddsEvent = {
  id: string
  home_team: string
  away_team: string
  commence_time: string
}
type OddsScore = OddsEvent & {
  completed: boolean
  scores: Array<{ name: string; score: string }> | null
}
export type SyncResult = {
  synced: number
  updated: number
  recalculated: boolean
  quotaRemaining: number | null
  error?: string
}

// ─── Main sync ───────────────────────────────────────────────────────────────
export async function syncFromOddsAPI(): Promise<SyncResult> {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) return { synced: 0, updated: 0, recalculated: false, quotaRemaining: null, error: 'ODDS_API_KEY not set' }

  let quotaRemaining: number | null = null

  try {
    // ── 1. Events (fixtures) — 0 quota cost ─────────────────────────────────
    const eventsRes = await fetch(
      `${ODDS_BASE}/sports/${SPORT_KEY}/events?apiKey=${apiKey}&dateFormat=iso`,
      { cache: 'no-store' }
    )
    quotaRemaining = Number(eventsRes.headers.get('x-requests-remaining') ?? null)

    if (!eventsRes.ok) {
      const txt = await eventsRes.text()
      return { synced: 0, updated: 0, recalculated: false, quotaRemaining, error: `Events: ${txt}` }
    }
    const events: OddsEvent[] = await eventsRes.json()
    console.log(`[Sync] ${events.length} events fetched. Quota remaining: ${quotaRemaining}`)

    // ── 2. Scores — costs 1 request, returns 3 days back + live ─────────────
    const scoresRes = await fetch(
      `${ODDS_BASE}/sports/${SPORT_KEY}/scores?apiKey=${apiKey}&daysFrom=3&dateFormat=iso`,
      { cache: 'no-store' }
    )
    quotaRemaining = Number(scoresRes.headers.get('x-requests-remaining') ?? quotaRemaining)

    const scoresMap: Record<string, OddsScore> = {}
    if (scoresRes.ok) {
      const scoresData: OddsScore[] = await scoresRes.json()
      scoresData.forEach(s => { scoresMap[s.id] = s })
      console.log(`[Sync] ${scoresData.length} scores fetched`)
    }

    // ── 3. Load existing matches from Supabase ───────────────────────────────
    const { data: existingRows } = await supabaseAdmin
      .from('matches')
      .select('id, odds_event_id, status, score_home, score_away')

    const existingMap: Record<string, { id: string; status: string; score_home: number | null; score_away: number | null }> = {}
    ;(existingRows || []).forEach((m: any) => {
      if (m.odds_event_id) existingMap[m.odds_event_id] = m
    })

    // ── 4. Upsert matches ─────────────────────────────────────────────────────
    let synced = 0
    let updated = 0
    let hasNewResults = false
    const now = Date.now()

    for (const ev of events) {
      const score = scoresMap[ev.id]
      const existing = existingMap[ev.id]

      // Parse scores
      let scoreHome: number | null = null
      let scoreAway: number | null = null
      if (score?.scores) {
        const h = score.scores.find(s => s.name === ev.home_team)
        const a = score.scores.find(s => s.name === ev.away_team)
        if (h) scoreHome = parseInt(h.score, 10)
        if (a) scoreAway = parseInt(a.score, 10)
      }

      // Determine status
      const commenceMs = new Date(ev.commence_time).getTime()
      const minsSince  = (now - commenceMs) / 60000
      let status: 'upcoming' | 'live' | 'done'

      if (score?.completed) {
        status = 'done'
      } else if (minsSince >= 0 && minsSince < 130) {
        status = 'live'
      } else if (commenceMs > now) {
        status = 'upcoming'
      } else {
        status = 'live' // past but no completion flag yet
      }

      const matchData = {
        odds_event_id: ev.id,
        home_team:     ev.home_team,
        away_team:     ev.away_team,
        home_flag:     getFlag(ev.home_team),
        away_flag:     getFlag(ev.away_team),
        match_date:    ev.commence_time,
        fase:          detectPhase(ev.commence_time),
        status,
        score_home:    scoreHome,
        score_away:    scoreAway,
        sort_order:    Math.floor(commenceMs / 1000),
      }

      if (!existing) {
        const { error } = await supabaseAdmin.from('matches').insert(matchData)
        if (!error) synced++
      } else {
        const changed =
          existing.status !== status ||
          existing.score_home !== scoreHome ||
          existing.score_away !== scoreAway

        if (changed) {
          const { error } = await supabaseAdmin
            .from('matches')
            .update(matchData)
            .eq('odds_event_id', ev.id)
          if (!error) {
            updated++
            if (status === 'done' && existing.status !== 'done') hasNewResults = true
          }
        }
      }
    }

    // ── 5. Recalculate ranking when new results arrived ──────────────────────
    let recalculated = false
    if (hasNewResults) {
      const { error } = await supabaseAdmin.rpc('recalc_all_scores')
      recalculated = !error
      console.log('[Sync] Recalculated scores:', recalculated)
    }

    return { synced, updated, recalculated, quotaRemaining }
  } catch (err: any) {
    console.error('[Sync] Error:', err)
    return { synced: 0, updated: 0, recalculated: false, quotaRemaining, error: err.message }
  }
}
