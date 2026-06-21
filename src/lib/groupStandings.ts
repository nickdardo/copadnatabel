import type { Match } from '@/lib/supabase'
import { FASE_ORDER } from '@/lib/supabase'

export type GroupInfo = {
  label: string       // 'A', 'B', 'C'...
  teams: string[]
  matches: Match[]
}

export type TeamStanding = {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
}

// Distribuição OFICIAL dos 12 grupos da Copa do Mundo 2026 (fonte: fifa.com).
// Usada como base — sempre pode ser corrigida pontualmente pelo admin via
// a tabela `team_group_overrides` (ex: se algum time desistir e for trocado).
export const OFFICIAL_GROUPS_2026: Record<string, string> = {
  'México': 'A', 'Coreia do Sul': 'A', 'Tchéquia': 'A', 'África do Sul': 'A',
  'Canadá': 'B', 'Suíça': 'B', 'Bósnia e Herzegovina': 'B', 'Qatar': 'B',
  'Brasil': 'C', 'Marrocos': 'C', 'Escócia': 'C', 'Haiti': 'C',
  'Estados Unidos': 'D', 'Austrália': 'D', 'Paraguai': 'D', 'Turquia': 'D',
  'Alemanha': 'E', 'Costa do Marfim': 'E', 'Equador': 'E', 'Curaçau': 'E',
  'Países Baixos': 'F', 'Japão': 'F', 'Suécia': 'F', 'Tunísia': 'F',
  'Nova Zelândia': 'G', 'Irã': 'G', 'Bélgica': 'G', 'Egito': 'G',
  'Uruguai': 'H', 'Arábia Saudita': 'H', 'Espanha': 'H', 'Cabo Verde': 'H',
  'Noruega': 'I', 'França': 'I', 'Senegal': 'I', 'Iraque': 'I',
  'Argentina': 'J', 'Áustria': 'J', 'Jordânia': 'J', 'Argélia': 'J',
  'Colômbia': 'K', 'RD Congo': 'K', 'Portugal': 'K', 'Uzbequistão': 'K',
  'Inglaterra': 'L', 'Gana': 'L', 'Panamá': 'L', 'Croácia': 'L',
}

// Mesma lista, mas organizada por grupo — útil para a tela de edição do
// admin mostrar todos os 48 times mesmo antes de qualquer jogo existir.
export const ALL_TEAMS_BY_GROUP_2026: Record<string, string[]> = (() => {
  const byGroup: Record<string, string[]> = {}
  Object.entries(OFFICIAL_GROUPS_2026).forEach(([team, label]) => {
    if (!byGroup[label]) byGroup[label] = []
    byGroup[label].push(team)
  })
  Object.values(byGroup).forEach(list => list.sort())
  return byGroup
})()

/**
 * Detecta os grupos da fase de grupos. Usa, em ordem de prioridade:
 * 1) Correção manual do admin (`overrides`, salva no banco) — sempre vence.
 * 2) Distribuição oficial hardcoded (`OFFICIAL_GROUPS_2026`).
 * 3) Como último recurso, agrupamento automático por "quem jogou com quem"
 *    nos confrontos já cadastrados — só entra em ação para times que não
 *    estejam nem nos overrides nem na lista oficial (ex: nome digitado de
 *    forma diferente do esperado).
 */
export function detectGroups(allMatches: Match[], overrides: Record<string, string> = {}): GroupInfo[] {
  const groupMatches = allMatches.filter(m => m.fase === 'Fase de Grupos')

  const allTeams = new Set<string>()
  groupMatches.forEach(m => { allTeams.add(m.home_team); allTeams.add(m.away_team) })

  const labelOf: Record<string, string> = {}
  const unresolved: string[] = []
  allTeams.forEach(team => {
    const label = overrides[team] || OFFICIAL_GROUPS_2026[team]
    if (label) labelOf[team] = label
    else unresolved.push(team)
  })

  // Fallback por componente conectado, só para times não resolvidos acima
  if (unresolved.length > 0) {
    const adj: Record<string, Set<string>> = {}
    function addEdge(a: string, b: string) {
      if (!adj[a]) adj[a] = new Set()
      if (!adj[b]) adj[b] = new Set()
      adj[a].add(b); adj[b].add(a)
    }
    groupMatches.forEach(m => {
      if (unresolved.includes(m.home_team) || unresolved.includes(m.away_team)) {
        addEdge(m.home_team, m.away_team)
      }
    })
    const visited = new Set<string>()
    let extraIndex = 0
    unresolved.forEach(team => {
      if (visited.has(team) || labelOf[team]) return
      const cluster: string[] = []
      const queue = [team]
      visited.add(team)
      while (queue.length) {
        const t = queue.shift()!
        cluster.push(t)
        ;(adj[t] || new Set()).forEach(n => { if (!visited.has(n)) { visited.add(n); queue.push(n) } })
      }
      const label = `?${++extraIndex}` // marca visualmente como não confirmado
      cluster.forEach(t => { labelOf[t] = label })
    })
  }

  const byLabel: Record<string, string[]> = {}
  Object.entries(labelOf).forEach(([team, label]) => {
    if (!byLabel[label]) byLabel[label] = []
    byLabel[label].push(team)
  })

  return Object.entries(byLabel)
    .map(([label, teams]) => ({
      label,
      teams: teams.sort(),
      matches: groupMatches.filter(m => teams.includes(m.home_team) && teams.includes(m.away_team)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Calcula a classificação (J/V/E/D/SG/Pts) de um grupo, com os critérios
 *  clássicos de desempate: pontos → saldo de gols → gols marcados. */
export function calcGroupTable(group: GroupInfo): TeamStanding[] {
  const table: Record<string, TeamStanding> = {}
  group.teams.forEach(t => {
    table[t] = { team: t, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 }
  })

  group.matches.forEach(m => {
    if (m.status !== 'done' || m.score_home == null || m.score_away == null) return
    const h = table[m.home_team], a = table[m.away_team]
    if (!h || !a) return
    h.played++; a.played++
    h.goalsFor += m.score_home; h.goalsAgainst += m.score_away
    a.goalsFor += m.score_away; a.goalsAgainst += m.score_home
    if (m.score_home > m.score_away) { h.won++; h.points += 3; a.lost++ }
    else if (m.score_home < m.score_away) { a.won++; a.points += 3; h.lost++ }
    else { h.drawn++; a.drawn++; h.points += 1; a.points += 1 }
  })

  Object.values(table).forEach(t => { t.goalDiff = t.goalsFor - t.goalsAgainst })

  return Object.values(table).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    if (y.goalDiff !== x.goalDiff) return y.goalDiff - x.goalDiff
    return y.goalsFor - x.goalsFor
  })
}

/** Detecta qual fase do torneio deve ser exibida: a mais avançada que já tem
 *  algum jogo iniciado ou encerrado. Enquanto nada começou, mostra Grupos. */
export function detectActivePhase(allMatches: Match[]): string {
  const order = [...FASE_ORDER].reverse() // mais avançada primeiro
  for (const phase of order) {
    const started = allMatches.some(m => m.fase === phase && m.status !== 'upcoming')
    if (started) return phase
  }
  return 'Fase de Grupos'
}

/** Fases de mata-mata, na ordem de exibição do bracket (esquerda → direita). */
export const KNOCKOUT_PHASES = ['Oitavas de Final', 'Quartas de Final', 'Semifinais', 'Final']
