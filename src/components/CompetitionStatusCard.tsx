import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from('team_group_overrides').select('team_name, group_label').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((r: { team_name: string; group_label: string }) => { map[r.team_name] = r.group_label })
        setOverrides(map)
      }
    })
  }, [])

  const groups = useMemo(() => detectGroups(matches, overrides), [matches, overrides])
  const [active, setActive] = useState(0)

  if (groups.length === 0) {
    return <p className="text-[12px] text-gray-400 text-center py-4">Tabela de grupos aparece aqui quando os jogos forem cadastrados.</p>
  }

  const group = groups[Math.min(active, groups.length - 1)]
  const standings = calcGroupTable(group)
  const upcomingInGroup = group.matches
    .filter(m => m.status === 'upcoming')
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  return (
    <div>
      <div className="relative -mx-1">
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 px-1">
          {groups.map((g, i) => (
            <button key={g.label} onClick={() => setActive(i)}
              className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                i === active ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              Grupo {g.label}
            </button>
          ))}
        </div>
        {/* Indicador visual de que dá para arrastar para o lado */}
        <div className="absolute top-0 right-0 bottom-2 w-10 pointer-events-none flex items-center justify-end pr-0.5"
          style={{ background: 'linear-gradient(to right, transparent, white 70%)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18"/>
          </svg>
        </div>
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

      {/* Próximos jogos do grupo, ou resumo de classificação se a fase já terminou */}
      {upcomingInGroup.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-gray-500 px-1 mb-1.5">Próximos jogos do Grupo {group.label}</p>
          <div className="space-y-1.5">
            {upcomingInGroup.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <FlagImg team={m.home_team} size={14}/>
                  <span className="text-[11px] text-gray-700 truncate">{m.home_team}</span>
                </div>
                <span className="text-[10px] text-gray-400 px-2 flex-shrink-0">vs</span>
                <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                  <span className="text-[11px] text-gray-700 truncate text-right">{m.away_team}</span>
                  <FlagImg team={m.away_team} size={14}/>
                </div>
                <span className="text-[10px] text-blue-500 font-medium ml-2 flex-shrink-0">{fmtShortDate(m.match_date)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : standings.every(s => s.played > 0) ? (
        <div className="mt-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span className="text-[11px] font-semibold text-green-700">Fase de grupos concluída</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {standings.slice(0, 2).map(s => (
              <span key={s.team} className="flex items-center gap-1 text-[11px] text-green-700 bg-white px-2 py-1 rounded-full border border-green-200">
                <FlagImg team={s.team} size={12}/>{s.team}
              </span>
            ))}
            <span className="text-[10px] text-green-600">avançam para a próxima fase</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Bracket de mata-mata ──
function MatchBox({ match, full }: { match?: Match; full?: boolean }) {
  const sizeClass = full ? 'w-full' : 'w-[148px] flex-shrink-0'
  if (!match) {
    return (
      <div className={`bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2 ${sizeClass}`}>
        <p className="text-[10px] text-gray-400 text-center">A definir</p>
      </div>
    )
  }
  const done = match.status === 'done'
  return (
    <div className={`rounded-lg px-3 py-2.5 border ${sizeClass} ${done ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FlagImg team={match.home_team} size={full ? 18 : 14}/>
          <span className={`truncate text-gray-700 ${full ? 'text-[12px]' : 'text-[10px]'}`}>{match.home_team}</span>
        </div>
        <span className={`font-bold flex-shrink-0 ${full ? 'text-[13px]' : 'text-[11px]'} ${done ? 'text-gray-900' : 'text-gray-300'}`}>{match.score_home ?? '-'}</span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FlagImg team={match.away_team} size={full ? 18 : 14}/>
          <span className={`truncate text-gray-700 ${full ? 'text-[12px]' : 'text-[10px]'}`}>{match.away_team}</span>
        </div>
        <span className={`font-bold flex-shrink-0 ${full ? 'text-[13px]' : 'text-[11px]'} ${done ? 'text-gray-900' : 'text-gray-300'}`}>{match.score_away ?? '-'}</span>
      </div>
      {!done && match.match_date && (
        <p className="text-[9px] text-blue-400 text-center mt-1.5">{fmtShortDate(match.match_date)}</p>
      )}
    </div>
  )
}

const PHASE_SHORT_LABEL: Record<string, string> = {
  'Dezesseis Avos de Final': 'Dezesseis avos de final',
  'Oitavas de Final': 'Oitavas de final',
  'Quartas de Final': 'Quartas de final',
  'Semifinais': 'Semifinais',
  'Final': 'Final',
}

// Fases que pertencem a um dos lados da chave — a Final é o ponto de
// encontro dos dois lados, por isso fica fora dessa lista.
const SIDE_PHASES = ['Dezesseis Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinais']

function ChevronDown() {
  return (
    <div className="flex justify-center py-1.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#85B7EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
  )
}

function KnockoutBracket({ matches }: { matches: Match[] }) {
  const [side, setSide] = useState<'A' | 'B'>('A')

  const hasAnyKnockout = useMemo(() => KNOCKOUT_PHASES.some(p => matches.some(m => m.fase === p)), [matches])
  const finalMatch = matches.find(m => m.fase === 'Final')

  const groupsForSide = useMemo(() => {
    return SIDE_PHASES
      .map(phase => ({
        phase,
        matches: matches
          .filter(m => m.fase === phase && m.bracket_side === side)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      }))
      .filter(g => g.matches.length > 0)
  }, [matches, side])

  if (!hasAnyKnockout) {
    return (
      <p className="text-[12px] text-gray-400 text-center py-6">
        O chaveamento aparece aqui quando a fase de grupos terminar e os primeiros confrontos forem definidos.
      </p>
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button onClick={() => setSide('A')}
          className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${side === 'A' ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500'}`}>
          Lado A
        </button>
        <button onClick={() => setSide('B')}
          className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${side === 'B' ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500'}`}>
          Lado B
        </button>
      </div>

      {groupsForSide.length === 0 && (
        <p className="text-[12px] text-gray-400 text-center py-4">
          Nenhum confronto deste lado classificado ainda.
        </p>
      )}

      {groupsForSide.map((g, i) => (
        <div key={g.phase}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{PHASE_SHORT_LABEL[g.phase] || g.phase}</p>
          <div className="space-y-2">
            {g.matches.map(m => <MatchBox key={m.id} match={m} full/>)}
          </div>
          {i < groupsForSide.length - 1 && <ChevronDown/>}
        </div>
      ))}

      {finalMatch && (
        <>
          <ChevronDown/>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Final</p>
          <MatchBox match={finalMatch} full/>
        </>
      )}
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
          {isGroupStage ? 'Classificação dos grupos' : 'Chaveamento mata-mata'}
        </h3>
      </div>
      {isGroupStage ? <GroupsTable matches={matches}/> : <KnockoutBracket matches={matches}/>}
    </div>
  )
}
