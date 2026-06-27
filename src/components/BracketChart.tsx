import FlagImg from '@/components/FlagImg'
import {
  OFFICIAL_BRACKET_2026, resolveSlot, rankThirdPlaceTeams,
  type OfficialSlot,
} from '@/lib/officialBracket2026'
import { calcGroupTable } from '@/lib/groupStandings'
import type { Match } from '@/lib/supabase'

type BracketCtx = {
  standingsByGroup: Record<string, ReturnType<typeof calcGroupTable>>
  top8Thirds: ReturnType<typeof rankThirdPlaceTeams>
  matchesByOfficialNumber: Record<number, Match>
}

type Props = {
  ctx: BracketCtx
  /** Modo admin: mostra seletor pra "melhor 3º" ambíguo e botões de
   *  criar/vincular. Modo jogador (default): só leitura. */
  editable?: boolean
  pickedThird?: Record<number, string>
  onPickThird?: (key: number, value: string) => void
  onCreate?: (slot: OfficialSlot, home: string, away: string) => void
  onLink?: (slot: OfficialSlot, match: Match) => void
  creatingMatch?: number | null
  findSyncedMatch?: (fase: string, home: string, away: string) => Match | undefined
}

const PHASE_ABBR: Record<string, string> = {
  'Dezesseis Avos de Final': 'Dezesseis avos',
  'Oitavas de Final': 'Oitavas',
  'Quartas de Final': 'Quartas',
  'Semifinais': 'Semifinal',
}

const COL_WIDTH = 132

function SlotBox({ slot, ctx, editable, pickedThird, onPickThird, onCreate, onLink, creatingMatch, findSyncedMatch }: Props & { slot: OfficialSlot }) {
  const existing = ctx.matchesByOfficialNumber[slot.match]
  const home = resolveSlot(slot.home, ctx.standingsByGroup, ctx.top8Thirds, ctx.matchesByOfficialNumber)
  const away = resolveSlot(slot.away, ctx.standingsByGroup, ctx.top8Thirds, ctx.matchesByOfficialNumber)

  if (existing) {
    return (
      <div style={{ width: COL_WIDTH }} className="bg-white rounded-lg border border-green-100 px-2 py-1.5 flex-shrink-0">
        <div className="text-[8px] font-semibold text-green-600 mb-1">J{slot.match} ✓</div>
        <div className="flex items-center gap-1 text-[10.5px] text-gray-800 truncate"><FlagImg team={existing.home_team} size={12}/><span className="truncate">{existing.home_team}</span></div>
        <div className="flex items-center gap-1 text-[10.5px] text-gray-800 truncate mt-0.5"><FlagImg team={existing.away_team} size={12}/><span className="truncate">{existing.away_team}</span></div>
      </div>
    )
  }

  const homeCandKey = slot.match * 10 + 1
  const awayCandKey = slot.match * 10 + 2
  const homeTeam = home.candidates && home.candidates.length > 1 ? pickedThird?.[homeCandKey] : home.team
  const awayTeam = away.candidates && away.candidates.length > 1 ? pickedThird?.[awayCandKey] : away.team
  const bothKnown = !!homeTeam && !!awayTeam
  const synced = editable && bothKnown && findSyncedMatch ? findSyncedMatch(slot.fase, homeTeam!, awayTeam!) : undefined

  return (
    <div style={{ width: COL_WIDTH }} className="bg-white rounded-lg border border-gray-100 px-2 py-1.5 flex-shrink-0">
      <div className="text-[8px] font-semibold text-[#0099CC] mb-1">J{slot.match}</div>

      {editable && home.candidates && home.candidates.length > 1 ? (
        <select value={pickedThird?.[homeCandKey] || ''} onChange={e => onPickThird?.(homeCandKey, e.target.value)}
          className="w-full text-[9px] border border-amber-200 bg-amber-50 rounded px-1 py-0.5 mb-0.5">
          <option value="">3º — escolha</option>
          {home.candidates.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <div className={`flex items-center gap-1 text-[10.5px] truncate ${home.resolved ? 'text-gray-800' : 'text-gray-400'}`}>
          {home.resolved && home.team ? <FlagImg team={home.team} size={12}/> : null}
          <span className="truncate">{home.team || home.label}</span>
        </div>
      )}

      {editable && away.candidates && away.candidates.length > 1 ? (
        <select value={pickedThird?.[awayCandKey] || ''} onChange={e => onPickThird?.(awayCandKey, e.target.value)}
          className="w-full text-[9px] border border-amber-200 bg-amber-50 rounded px-1 py-0.5 mt-0.5">
          <option value="">3º — escolha</option>
          {away.candidates.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <div className={`flex items-center gap-1 text-[10.5px] truncate mt-0.5 ${away.resolved ? 'text-gray-800' : 'text-gray-400'}`}>
          {away.resolved && away.team ? <FlagImg team={away.team} size={12}/> : null}
          <span className="truncate">{away.team || away.label}</span>
        </div>
      )}

      {editable && bothKnown && synced && (
        <button onClick={() => onLink?.(slot, synced)} disabled={creatingMatch === slot.match}
          className="w-full mt-1.5 bg-green-600 text-white text-[8.5px] font-semibold py-1 rounded disabled:opacity-50">
          {creatingMatch === slot.match ? '...' : '✓ Vincular'}
        </button>
      )}
      {editable && bothKnown && !synced && (
        <button onClick={() => onCreate?.(slot, homeTeam!, awayTeam!)} disabled={creatingMatch === slot.match}
          className="w-full mt-1.5 bg-[#0099CC] text-white text-[8.5px] font-semibold py-1 rounded disabled:opacity-50">
          {creatingMatch === slot.match ? '...' : '+ Criar'}
        </button>
      )}
    </div>
  )
}

// Chave horizontal completa, estilo site oficial da FIFA: Dezesseis avos →
// Oitavas → Quartas → Semifinal do Lado A, Final no centro, e o mesmo
// caminho espelhado do Lado B. Rolagem horizontal no mobile.
export default function BracketChart(props: Props) {
  const { ctx } = props
  const sideAPhases = ['Dezesseis Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinais']
  const sideBPhasesReversed = ['Semifinais', 'Quartas de Final', 'Oitavas de Final', 'Dezesseis Avos de Final']
  const finalSlot = OFFICIAL_BRACKET_2026.find(s => s.fase === 'Final')

  function column(side: 'A' | 'B', phase: string, key: string) {
    const slots = OFFICIAL_BRACKET_2026.filter(s => s.side === side && s.fase === phase)
    if (slots.length === 0) return null
    return (
      <div key={key} className="flex flex-col gap-2 flex-shrink-0" style={{ width: COL_WIDTH }}>
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center">{PHASE_ABBR[phase]}</p>
        <div className="flex flex-col gap-2 justify-center flex-1">
          {slots.map(slot => <SlotBox key={slot.match} slot={slot} {...props}/>)}
        </div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }} className="-mx-1 px-1">
      <div className="flex gap-2.5 pb-2" style={{ minWidth: 'max-content' }}>
        {sideAPhases.map(phase => column('A', phase, 'A-' + phase))}
        <div className="flex flex-col gap-2 flex-shrink-0" style={{ width: COL_WIDTH }}>
          <p className="text-[9px] font-semibold text-[#0099CC] uppercase tracking-wide text-center">Final</p>
          <div className="flex flex-col justify-center flex-1">
            {finalSlot && <SlotBox slot={finalSlot} {...props}/>}
          </div>
        </div>
        {sideBPhasesReversed.map(phase => column('B', phase, 'B-' + phase))}
      </div>
    </div>
  )
}
