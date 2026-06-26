import type { Match } from '@/lib/supabase'
import { detectGroups, calcGroupTable, type GroupInfo } from '@/lib/groupStandings'

// ── Estrutura oficial da chave de mata-mata da Copa 2026 ──────────────────
// Confirmada via FIFA.com, Wikipedia e ESPN (jun/2026). Os números de jogo
// (73 a 104) e o encadeamento de quem enfrenta quem são fixos — só os NOMES
// dos times é que vão sendo resolvidos conforme a fase de grupos e os
// próprios jogos do mata-mata terminam. side é 'A' ou 'B' conforme o lado
// da chave que leva a cada semifinal; a Final e o 3º lugar não têm lado
// (são o encontro dos dois lados).

export type SlotRef =
  | { type: 'group_winner'; group: string }
  | { type: 'group_runnerup'; group: string }
  | { type: 'best_third'; groups: string[] }
  | { type: 'match_winner'; match: number }
  | { type: 'match_loser'; match: number }

export type OfficialSlot = {
  match: number
  fase: string
  side: 'A' | 'B' | null
  home: SlotRef
  away: SlotRef
  venue: string
  /** Data/hora aproximada (America/New_York ou local do jogo) — só um
   *  ponto de partida pro admin confirmar/ajustar ao criar o confronto. */
  dateHint?: string
}

export const OFFICIAL_BRACKET_2026: OfficialSlot[] = [
  // ── Dezesseis avos de final (Round of 32) ──
  { match: 73, fase: 'Dezesseis Avos de Final', side: 'A', venue: 'Los Angeles', dateHint: '2026-06-28T20:00',
    home: { type: 'group_runnerup', group: 'A' }, away: { type: 'group_runnerup', group: 'B' } },
  { match: 74, fase: 'Dezesseis Avos de Final', side: 'A', venue: 'Foxborough', dateHint: '2026-06-29T21:30',
    home: { type: 'group_winner', group: 'E' }, away: { type: 'best_third', groups: ['A', 'B', 'C', 'D', 'F'] } },
  { match: 75, fase: 'Dezesseis Avos de Final', side: 'A', venue: 'Guadalajara', dateHint: '2026-06-30T02:00',
    home: { type: 'group_winner', group: 'F' }, away: { type: 'group_runnerup', group: 'C' } },
  { match: 76, fase: 'Dezesseis Avos de Final', side: 'B', venue: 'Houston', dateHint: '2026-06-29T18:00',
    home: { type: 'group_winner', group: 'C' }, away: { type: 'group_runnerup', group: 'F' } },
  { match: 77, fase: 'Dezesseis Avos de Final', side: 'A', venue: 'East Rutherford', dateHint: '2026-06-30T22:00',
    home: { type: 'group_winner', group: 'I' }, away: { type: 'best_third', groups: ['C', 'D', 'F', 'G', 'H'] } },
  { match: 78, fase: 'Dezesseis Avos de Final', side: 'B', venue: 'Arlington', dateHint: '2026-06-30T18:00',
    home: { type: 'group_runnerup', group: 'E' }, away: { type: 'group_runnerup', group: 'I' } },
  { match: 79, fase: 'Dezesseis Avos de Final', side: 'B', venue: 'Cidade do México', dateHint: '2026-07-01T02:00',
    home: { type: 'group_winner', group: 'A' }, away: { type: 'best_third', groups: ['C', 'E', 'F', 'H', 'I'] } },
  { match: 80, fase: 'Dezesseis Avos de Final', side: 'B', venue: 'Atlanta', dateHint: '2026-07-01T17:00',
    home: { type: 'group_winner', group: 'L' }, away: { type: 'best_third', groups: ['E', 'H', 'I', 'J', 'K'] } },
  { match: 81, fase: 'Dezesseis Avos de Final', side: 'A', venue: 'Santa Clara', dateHint: '2026-07-02T01:00',
    home: { type: 'group_winner', group: 'D' }, away: { type: 'best_third', groups: ['B', 'E', 'F', 'I', 'J'] } },
  { match: 82, fase: 'Dezesseis Avos de Final', side: 'A', venue: 'Seattle', dateHint: '2026-07-01T21:00',
    home: { type: 'group_winner', group: 'G' }, away: { type: 'best_third', groups: ['A', 'E', 'H', 'I', 'J'] } },
  { match: 83, fase: 'Dezesseis Avos de Final', side: 'A', venue: 'Toronto', dateHint: '2026-07-02T19:00',
    home: { type: 'group_runnerup', group: 'K' }, away: { type: 'group_runnerup', group: 'L' } },
  { match: 84, fase: 'Dezesseis Avos de Final', side: 'A', venue: 'Los Angeles', dateHint: '2026-07-02T20:00',
    home: { type: 'group_winner', group: 'H' }, away: { type: 'group_runnerup', group: 'J' } },
  { match: 85, fase: 'Dezesseis Avos de Final', side: 'B', venue: 'Vancouver', dateHint: '2026-07-02T04:00',
    home: { type: 'group_winner', group: 'B' }, away: { type: 'best_third', groups: ['E', 'F', 'G', 'I', 'J'] } },
  { match: 86, fase: 'Dezesseis Avos de Final', side: 'B', venue: 'Miami', dateHint: '2026-07-02T23:00',
    home: { type: 'group_winner', group: 'J' }, away: { type: 'group_runnerup', group: 'H' } },
  { match: 87, fase: 'Dezesseis Avos de Final', side: 'B', venue: 'Kansas City', dateHint: '2026-07-03T02:30',
    home: { type: 'group_winner', group: 'K' }, away: { type: 'best_third', groups: ['D', 'E', 'I', 'J', 'L'] } },
  { match: 88, fase: 'Dezesseis Avos de Final', side: 'B', venue: 'Arlington', dateHint: '2026-07-02T19:00',
    home: { type: 'group_runnerup', group: 'D' }, away: { type: 'group_runnerup', group: 'G' } },

  // ── Oitavas de final (Round of 16) ──
  { match: 89, fase: 'Oitavas de Final', side: 'A', venue: 'Philadelphia',
    home: { type: 'match_winner', match: 74 }, away: { type: 'match_winner', match: 77 } },
  { match: 90, fase: 'Oitavas de Final', side: 'A', venue: 'Houston',
    home: { type: 'match_winner', match: 73 }, away: { type: 'match_winner', match: 75 } },
  { match: 91, fase: 'Oitavas de Final', side: 'B', venue: 'East Rutherford',
    home: { type: 'match_winner', match: 76 }, away: { type: 'match_winner', match: 78 } },
  { match: 92, fase: 'Oitavas de Final', side: 'B', venue: 'Cidade do México',
    home: { type: 'match_winner', match: 79 }, away: { type: 'match_winner', match: 80 } },
  { match: 93, fase: 'Oitavas de Final', side: 'A', venue: 'Dallas',
    home: { type: 'match_winner', match: 83 }, away: { type: 'match_winner', match: 84 } },
  { match: 94, fase: 'Oitavas de Final', side: 'A', venue: 'Seattle',
    home: { type: 'match_winner', match: 81 }, away: { type: 'match_winner', match: 82 } },
  { match: 95, fase: 'Oitavas de Final', side: 'B', venue: 'Atlanta',
    home: { type: 'match_winner', match: 86 }, away: { type: 'match_winner', match: 88 } },
  { match: 96, fase: 'Oitavas de Final', side: 'B', venue: 'Vancouver',
    home: { type: 'match_winner', match: 85 }, away: { type: 'match_winner', match: 87 } },

  // ── Quartas de final ──
  { match: 97, fase: 'Quartas de Final', side: 'A', venue: 'Foxborough',
    home: { type: 'match_winner', match: 89 }, away: { type: 'match_winner', match: 90 } },
  { match: 98, fase: 'Quartas de Final', side: 'A', venue: 'Los Angeles',
    home: { type: 'match_winner', match: 93 }, away: { type: 'match_winner', match: 94 } },
  { match: 99, fase: 'Quartas de Final', side: 'B', venue: 'Miami',
    home: { type: 'match_winner', match: 91 }, away: { type: 'match_winner', match: 92 } },
  { match: 100, fase: 'Quartas de Final', side: 'B', venue: 'Kansas City',
    home: { type: 'match_winner', match: 95 }, away: { type: 'match_winner', match: 96 } },

  // ── Semifinais ──
  { match: 101, fase: 'Semifinais', side: 'A', venue: 'Arlington',
    home: { type: 'match_winner', match: 97 }, away: { type: 'match_winner', match: 98 } },
  { match: 102, fase: 'Semifinais', side: 'B', venue: 'Atlanta',
    home: { type: 'match_winner', match: 99 }, away: { type: 'match_winner', match: 100 } },

  // ── 3º lugar e Final (sem lado — é onde os dois lados se encontram) ──
  { match: 103, fase: 'Terceiro Lugar', side: null, venue: 'Miami',
    home: { type: 'match_loser', match: 101 }, away: { type: 'match_loser', match: 102 } },
  { match: 104, fase: 'Final', side: null, venue: 'East Rutherford',
    home: { type: 'match_winner', match: 101 }, away: { type: 'match_winner', match: 102 } },
]

export type ResolvedSlot = {
  team: string | null
  label: string
  resolved: boolean
  /** Só pra slots de "melhor 3º colocado": mais de 1 grupo elegível ainda
   *  dentro do top 8 — o admin precisa escolher manualmente qual é. */
  candidates?: string[]
}

/** Ranking dos 3os colocados de todos os 12 grupos, só por pontos / saldo /
 *  gols pró (sem critério de fair play da FIFA, por decisão consciente —
 *  mais simples e cobre a grande maioria dos casos). Retorna os 8 melhores. */
export function rankThirdPlaceTeams(groups: GroupInfo[]): { team: string; group: string; points: number; goalDiff: number; goalsFor: number }[] {
  const thirds = groups
    .map(g => {
      const table = calcGroupTable(g)
      const third = table[2]
      if (!third) return null
      return { team: third.team, group: g.label, points: third.points, goalDiff: third.goalDiff, goalsFor: third.goalsFor }
    })
    .filter((x): x is { team: string; group: string; points: number; goalDiff: number; goalsFor: number } => x !== null)

  return thirds
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
    .slice(0, 8)
}

/** Resolve um SlotRef pro nome do time, usando a classificação atual dos
 *  grupos e os confrontos de mata-mata já criados/encerrados no banco. */
export function resolveSlot(
  ref: SlotRef,
  standingsByGroup: Record<string, ReturnType<typeof calcGroupTable>>,
  top8Thirds: ReturnType<typeof rankThirdPlaceTeams>,
  matchesByOfficialNumber: Record<number, Match>
): ResolvedSlot {
  if (ref.type === 'group_winner') {
    const t = standingsByGroup[ref.group]?.[0]
    return { team: t?.team ?? null, label: `1º Grupo ${ref.group}`, resolved: !!t }
  }
  if (ref.type === 'group_runnerup') {
    const t = standingsByGroup[ref.group]?.[1]
    return { team: t?.team ?? null, label: `2º Grupo ${ref.group}`, resolved: !!t }
  }
  if (ref.type === 'best_third') {
    const label = `Melhor 3º entre ${ref.groups.join('·')}`
    const candidates = top8Thirds.filter(t => ref.groups.includes(t.group)).map(t => t.team)
    if (candidates.length === 1) return { team: candidates[0], label, resolved: true }
    if (candidates.length > 1) return { team: null, label, resolved: false, candidates }
    return { team: null, label, resolved: false }
  }
  if (ref.type === 'match_winner') {
    const m = matchesByOfficialNumber[ref.match]
    const label = `Vencedor Jogo ${ref.match}`
    if (m?.status === 'done' && m.score_home != null && m.score_away != null && m.score_home !== m.score_away) {
      return { team: m.score_home > m.score_away ? m.home_team : m.away_team, label, resolved: true }
    }
    return { team: null, label, resolved: false }
  }
  // match_loser
  const m = matchesByOfficialNumber[ref.match]
  const label = `Perdedor Jogo ${ref.match}`
  if (m?.status === 'done' && m.score_home != null && m.score_away != null && m.score_home !== m.score_away) {
    return { team: m.score_home > m.score_away ? m.away_team : m.home_team, label, resolved: true }
  }
  return { team: null, label, resolved: false }
}

/** Monta tudo que o painel precisa: standings por grupo, top 8 terceiros,
 *  e o map de confrontos reais já criados por número oficial de jogo. */
export function buildBracketContext(allMatches: Match[], groupOverrides: Record<string, string>) {
  const groups = detectGroups(allMatches, groupOverrides)
  const standingsByGroup: Record<string, ReturnType<typeof calcGroupTable>> = {}
  groups.forEach(g => { standingsByGroup[g.label] = calcGroupTable(g) })

  const top8Thirds = rankThirdPlaceTeams(groups)

  const matchesByOfficialNumber: Record<number, Match> = {}
  allMatches.forEach(m => {
    if (m.official_match_number) matchesByOfficialNumber[m.official_match_number] = m
  })

  return { standingsByGroup, top8Thirds, matchesByOfficialNumber }
}
