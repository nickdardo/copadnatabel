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

/**
 * Detecta automaticamente os grupos da fase de grupos a partir dos próprios
 * confrontos já cadastrados — sem precisar de nenhum cadastro manual nem
 * fonte externa. Cada grupo de 4 seleções joga exatamente entre si (todos
 * contra todos), então basta encontrar os "clusters" de times conectados
 * pelos confrontos da fase de grupos (componentes conectados de um grafo).
 */
export function detectGroups(allMatches: Match[]): GroupInfo[] {
  const groupMatches = allMatches.filter(m => m.fase === 'Fase de Grupos')

  const adj: Record<string, Set<string>> = {}
  function addEdge(a: string, b: string) {
    if (!adj[a]) adj[a] = new Set()
    if (!adj[b]) adj[b] = new Set()
    adj[a].add(b)
    adj[b].add(a)
  }
  groupMatches.forEach(m => addEdge(m.home_team, m.away_team))

  const visited = new Set<string>()
  const clusters: string[][] = []
  Object.keys(adj).forEach(team => {
    if (visited.has(team)) return
    const cluster: string[] = []
    const queue = [team]
    visited.add(team)
    while (queue.length) {
      const t = queue.shift()!
      cluster.push(t)
      adj[t].forEach(n => { if (!visited.has(n)) { visited.add(n); queue.push(n) } })
    }
    clusters.push(cluster)
  })

  // Ordem estável: pelo nome do time alfabeticamente menor de cada grupo
  clusters.sort((a, b) => [...a].sort()[0].localeCompare([...b].sort()[0]))

  const labels = 'ABCDEFGHIJKL'
  return clusters.map((teams, i) => ({
    label: labels[i] || String(i + 1),
    teams: [...teams].sort(),
    matches: groupMatches.filter(m => teams.includes(m.home_team) && teams.includes(m.away_team)),
  }))
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
