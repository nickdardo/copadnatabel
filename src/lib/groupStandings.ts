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
// Inclui também o nome em inglês de cada seleção como chave alternativa —
// rede de segurança para jogos que tenham sido sincronizados antes de uma
// tradução existir no sistema (o nome fica em inglês no banco até o time
// jogar de novo e o sync atualizar).
export const OFFICIAL_GROUPS_2026: Record<string, string> = {
  'México': 'A', 'Mexico': 'A',
  'Coreia do Sul': 'A', 'South Korea': 'A', 'Korea Republic': 'A',
  'Tchéquia': 'A', 'Czech Republic': 'A', 'Czechia': 'A',
  'África do Sul': 'A', 'South Africa': 'A',
  'Canadá': 'B', 'Canada': 'B',
  'Suíça': 'B', 'Switzerland': 'B',
  'Bósnia e Herzegovina': 'B', 'Bosnia and Herzegovina': 'B', 'Bosnia & Herzegovina': 'B',
  'Qatar': 'B',
  'Brasil': 'C', 'Brazil': 'C',
  'Marrocos': 'C', 'Morocco': 'C',
  'Escócia': 'C', 'Scotland': 'C',
  'Haiti': 'C',
  'Estados Unidos': 'D', 'United States': 'D', 'USA': 'D',
  'Austrália': 'D', 'Australia': 'D',
  'Paraguai': 'D', 'Paraguay': 'D',
  'Turquia': 'D', 'Turkey': 'D', 'Turkiye': 'D',
  'Alemanha': 'E', 'Germany': 'E',
  'Costa do Marfim': 'E', "Ivory Coast": 'E', "Cote d'Ivoire": 'E',
  'Equador': 'E', 'Ecuador': 'E',
  'Curaçau': 'E', 'Curacao': 'E', 'Curaçao': 'E',
  'Países Baixos': 'F', 'Netherlands': 'F', 'Holanda': 'F',
  'Japão': 'F', 'Japan': 'F',
  'Suécia': 'F', 'Sweden': 'F',
  'Tunísia': 'F', 'Tunisia': 'F',
  'Nova Zelândia': 'G', 'New Zealand': 'G',
  'Irã': 'G', 'Iran': 'G',
  'Bélgica': 'G', 'Belgium': 'G',
  'Egito': 'G', 'Egypt': 'G',
  'Uruguai': 'H', 'Uruguay': 'H',
  'Arábia Saudita': 'H', 'Saudi Arabia': 'H',
  'Espanha': 'H', 'Spain': 'H',
  'Cabo Verde': 'H', 'Cape Verde': 'H',
  'Noruega': 'I', 'Norway': 'I',
  'França': 'I', 'France': 'I',
  'Senegal': 'I',
  'Iraque': 'I', 'Iraq': 'I',
  'Argentina': 'J',
  'Áustria': 'J', 'Austria': 'J',
  'Jordânia': 'J', 'Jordan': 'J',
  'Argélia': 'J', 'Algeria': 'J',
  'Colômbia': 'K', 'Colombia': 'K',
  'RD Congo': 'K', 'DR Congo': 'K', 'Congo DR': 'K',
  'Portugal': 'K',
  'Uzbequistão': 'K', 'Uzbekistan': 'K',
  'Inglaterra': 'L', 'England': 'L',
  'Gana': 'L', 'Ghana': 'L',
  'Panamá': 'L', 'Panama': 'L',
  'Croácia': 'L', 'Croatia': 'L',
}

// Lista "oficial" só com os nomes em português, para exibição no editor do
// admin (o mapa OFFICIAL_GROUPS_2026 acima tem entradas duplicadas em inglês
// como fallback de resiliência, mas isso não deve aparecer na tela de edição).
const PT_NAMES_BY_GROUP: Record<string, string[]> = {
  A: ['México', 'Coreia do Sul', 'Tchéquia', 'África do Sul'],
  B: ['Canadá', 'Suíça', 'Bósnia e Herzegovina', 'Qatar'],
  C: ['Brasil', 'Marrocos', 'Escócia', 'Haiti'],
  D: ['Estados Unidos', 'Austrália', 'Paraguai', 'Turquia'],
  E: ['Alemanha', 'Costa do Marfim', 'Equador', 'Curaçau'],
  F: ['Países Baixos', 'Japão', 'Suécia', 'Tunísia'],
  G: ['Nova Zelândia', 'Irã', 'Bélgica', 'Egito'],
  H: ['Uruguai', 'Arábia Saudita', 'Espanha', 'Cabo Verde'],
  I: ['Noruega', 'França', 'Senegal', 'Iraque'],
  J: ['Argentina', 'Áustria', 'Jordânia', 'Argélia'],
  K: ['Colômbia', 'RD Congo', 'Portugal', 'Uzbequistão'],
  L: ['Inglaterra', 'Gana', 'Panamá', 'Croácia'],
}

// Mesma lista, mas organizada por grupo — útil para a tela de edição do
// admin mostrar todos os 48 times mesmo antes de qualquer jogo existir.
export const ALL_TEAMS_BY_GROUP_2026: Record<string, string[]> = PT_NAMES_BY_GROUP

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
    .sort((a, b) => {
      // Grupos A-L sempre vêm primeiro, em ordem alfabética; qualquer
      // fallback não resolvido (label começando com "?") fica por último.
      const aUnresolved = a.label.startsWith('?')
      const bUnresolved = b.label.startsWith('?')
      if (aUnresolved !== bUnresolved) return aUnresolved ? 1 : -1
      return a.label.localeCompare(b.label)
    })
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
export const KNOCKOUT_PHASES = ['Dezesseis Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinais', 'Final']
