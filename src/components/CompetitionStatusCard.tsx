import { useState, useMemo } from 'react'
import FlagImg from '@/components/FlagImg'
import type { Match } from '@/lib/supabase'
import { detectGroups, calcGroupTable, detectActivePhase, KNOCKOUT_PHASES } from '@/lib/groupStandings'

type Props = { matches: Match[] }

function fmtShortDate(iso?: string) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) } catch { return '' }
}

// ── Tabela de grupos (fase de grupos) ──
function GroupsTable({ matches }: { matches: Match[] }) {
  const groups = useMemo(() => detectGroups(matches), [matches])
  const [active, setActive] = useState(0)

  if (groups.length === 0) {
    return <p className="text-[12px] text-gray-400 text-center py-4">Tabela de grupos aparece aqui quando os jogos forem cadastrados.</p>
  }

  const group = groups[Math.min(active, groups.length - 1)]
  const standings = calcGroupTable(group)

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
        {groups.map((g, i) => (
          <button key={g.label} onClick={() => setActive(i)}
            className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
              i === active ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            Grupo {g.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left font-medium py-1.5 px-2">Seleção</th>
              <th className="font-medium py-1.5 px-1 w-6">J</th>
              <th className="font-medium py-1.5 px-1 w-6">V</th>
              <th className="font-medium py-1.5 px-1 w-6">E</th>
              <th className="font-medium py-1.5 px-1 w-6">D</th>
              <th className="font-medium py-1.5 px-1 w-8">SG</th>
              <th className="font-medium py-1.5 px-2 w-8">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.team} className={`border-t border-gray-50 ${i < 2 ? 'bg-green-50/50' : ''}`}>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-gray-400 w-3 flex-shrink-0">{i + 1}</span>
                    <FlagImg team={s.team} size={16}/>
                    <span className="truncate font-medium text-gray-800">{s.team}</span>
                  </div>
                </td>
                <td className="text-center py-1.5 px-1 text-gray-600">{s.played}</td>
                <td className="text-center py-1.5 px-1 text-gray-600">{s.won}</td>
                <td className="text-center py-1.5 px-1 text-gray-600">{s.drawn}</td>
                <td className="text-center py-1.5 px-1 text-gray-600">{s.lost}</td>
                <td className="text-center py-1.5 px-1 text-gray-600">{s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}</td>
                <td className="text-center py-1.5 px-2 font-bold text-gray-900">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 px-1">Os 2 primeiros de cada grupo avançam de fase</p>
    </div>
  )
}

// ── Bracket de mata-mata ──
function MatchBox({ match }: { match?: Match }) {
  if (!match) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2 w-[148px] flex-shrink-0">
        <p className="text-[10px] text-gray-400 text-center">A definir</p>
      </div>
    )
  }
  const done = match.status === 'done'
  return (
    <div className={`rounded-lg px-2.5 py-2 w-[148px] flex-shrink-0 border ${done ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <FlagImg team={match.home_team} size={14}/>
          <span className="text-[10px] truncate text-gray-700">{match.home_team}</span>
        </div>
        <span className={`text-[11px] font-bold flex-shrink-0 ${done ? 'text-gray-900' : 'text-gray-300'}`}>{match.score_home ?? '-'}</span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <FlagImg team={match.away_team} size={14}/>
          <span className="text-[10px] truncate text-gray-700">{match.away_team}</span>
        </div>
        <span className={`text-[11px] font-bold flex-shrink-0 ${done ? 'text-gray-900' : 'text-gray-300'}`}>{match.score_away ?? '-'}</span>
      </div>
      {!done && match.match_date && (
        <p className="text-[9px] text-blue-400 text-center mt-1">{fmtShortDate(match.match_date)}</p>
      )}
    </div>
  )
}

function KnockoutBracket({ matches }: { matches: Match[] }) {
  const phasesWithGames = KNOCKOUT_PHASES.filter(p => matches.some(m => m.fase === p))
  const phasesToShow = phasesWithGames.length > 0 ? phasesWithGames : ['Oitavas de Final']

  return (
    <div>
      <div className="flex gap-6 overflow-x-auto pb-2 -mx-1 px-1">
        {phasesToShow.map(phase => {
          const phaseMatches = matches.filter(m => m.fase === phase).sort((a, b) => (a.sort_order||0) - (b.sort_order||0))
          const label = phase === 'Oitavas de Final' ? 'Oitavas' : phase === 'Quartas de Final' ? 'Quartas' : phase
          return (
            <div key={phase} className="flex flex-col gap-3 justify-around flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center">{label}</p>
              {phaseMatches.length > 0
                ? phaseMatches.map(m => <MatchBox key={m.id} match={m}/>)
                : <MatchBox/>}
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-2 px-1">Arraste para o lado para ver as próximas fases</p>
    </div>
  )
}

// ── Componente principal ──
export default function CompetitionStatusCard({ matches }: Props) {
  const activePhase = useMemo(() => detectActivePhase(matches), [matches])
  const isGroupStage = activePhase === 'Fase de Grupos'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
        <h3 className="text-[13px] font-bold text-gray-800">
          {isGroupStage ? 'Classificação dos grupos' : `Chaveamento — ${activePhase}`}
        </h3>
      </div>
      {isGroupStage ? <GroupsTable matches={matches}/> : <KnockoutBracket matches={matches}/>}
    </div>
  )
}
