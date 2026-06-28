import { useState } from 'react'
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

function fmtSlotDate(iso?: string | null, short?: boolean): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    // Sempre horário de Brasília, independente do fuso do celular de quem
    // está vendo — mesmo padrão usado no resto do app (fmtBRT em picks.tsx).
    const dd = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit' })
    const mm = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', month: '2-digit' })
    if (short) return `${dd}/${mm}`
    const time = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
    return `${dd}/${mm} ${time}`
  } catch { return '' }
}

function SlotBox({ slot, ctx, editable, pickedThird, onPickThird, onCreate, onLink, creatingMatch, findSyncedMatch, colWidth }: Props & { slot: OfficialSlot; colWidth: number }) {
  const existing = ctx.matchesByOfficialNumber[slot.match]
  const home = resolveSlot(slot.home, ctx.standingsByGroup, ctx.top8Thirds, ctx.matchesByOfficialNumber)
  const away = resolveSlot(slot.away, ctx.standingsByGroup, ctx.top8Thirds, ctx.matchesByOfficialNumber)
  const flagSize = colWidth < 110 ? 10 : 12
  const nameSize = colWidth < 110 ? '9.5px' : '10.5px'

  if (existing) {
    const dateStr = fmtSlotDate(existing.match_date, colWidth < 110)
    return (
      <div style={{ width: colWidth }} className="bg-white rounded-lg border border-green-100 px-1.5 py-1.5 flex-shrink-0">
        <div className="text-[7.5px] font-semibold text-green-600 mb-1">J{slot.match} ✓{dateStr ? ` · ${dateStr}` : ''}</div>
        <div className="flex items-center gap-1 truncate" style={{ fontSize: nameSize, color: '#1f2937' }}><FlagImg team={existing.home_team} size={flagSize}/><span className="truncate">{existing.home_team}</span></div>
        <div className="flex items-center gap-1 truncate mt-0.5" style={{ fontSize: nameSize, color: '#1f2937' }}><FlagImg team={existing.away_team} size={flagSize}/><span className="truncate">{existing.away_team}</span></div>
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
    <div style={{ width: colWidth }} className="bg-white rounded-lg border border-gray-100 px-1.5 py-1.5 flex-shrink-0">
      <div className="text-[7.5px] font-semibold text-[#0099CC] mb-1">J{slot.match}{slot.dateHint ? ` · ${fmtSlotDate(slot.dateHint, colWidth < 110)}` : ''}</div>

      {editable && home.candidates && home.candidates.length > 1 ? (
        <select value={pickedThird?.[homeCandKey] || ''} onChange={e => onPickThird?.(homeCandKey, e.target.value)}
          className="w-full text-[8.5px] border border-amber-200 bg-amber-50 rounded px-1 py-0.5 mb-0.5">
          <option value="">3º — escolha</option>
          {home.candidates.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <div className={`flex items-center gap-1 truncate ${home.resolved ? 'text-gray-800' : 'text-gray-400'}`} style={{ fontSize: nameSize }}>
          {home.resolved && home.team ? <FlagImg team={home.team} size={flagSize}/> : null}
          <span className="truncate">{home.team || home.label}</span>
        </div>
      )}

      {editable && away.candidates && away.candidates.length > 1 ? (
        <select value={pickedThird?.[awayCandKey] || ''} onChange={e => onPickThird?.(awayCandKey, e.target.value)}
          className="w-full text-[8.5px] border border-amber-200 bg-amber-50 rounded px-1 py-0.5 mt-0.5">
          <option value="">3º — escolha</option>
          {away.candidates.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <div className={`flex items-center gap-1 truncate mt-0.5 ${away.resolved ? 'text-gray-800' : 'text-gray-400'}`} style={{ fontSize: nameSize }}>
          {away.resolved && away.team ? <FlagImg team={away.team} size={flagSize}/> : null}
          <span className="truncate">{away.team || away.label}</span>
        </div>
      )}

      {editable && bothKnown && synced && (
        <button onClick={() => onLink?.(slot, synced)} disabled={creatingMatch === slot.match}
          className="w-full mt-1.5 bg-green-600 text-white text-[8px] font-semibold py-1 rounded disabled:opacity-50">
          {creatingMatch === slot.match ? '...' : '✓ Vincular'}
        </button>
      )}
      {editable && bothKnown && !synced && (
        <button onClick={() => onCreate?.(slot, homeTeam!, awayTeam!)} disabled={creatingMatch === slot.match}
          className="w-full mt-1.5 bg-[#0099CC] text-white text-[8px] font-semibold py-1 rounded disabled:opacity-50">
          {creatingMatch === slot.match ? '...' : '+ Criar'}
        </button>
      )}
    </div>
  )
}

function PhaseColumn({ side, phase, colWidth, accent, ...rest }: Props & { side: 'A' | 'B'; phase: string; colWidth: number; accent?: boolean }) {
  const slots = OFFICIAL_BRACKET_2026.filter(s => s.side === side && s.fase === phase)
  if (slots.length === 0) return null
  return (
    <div className="flex flex-col gap-2 flex-shrink-0" style={{ width: colWidth }}>
      <p className={`text-[8.5px] font-semibold uppercase tracking-wide text-center ${accent ? 'text-[#0099CC]' : 'text-gray-400'}`}>{PHASE_ABBR[phase]}</p>
      <div className="flex flex-col gap-2 justify-center flex-1">
        {slots.map(slot => <SlotBox key={slot.match} slot={slot} colWidth={colWidth} {...rest}/>)}
      </div>
    </div>
  )
}

// Visão compacta — chave horizontal completa numa linha só (9 colunas),
// rolagem lateral. Usada como prévia dentro do card.
function ScrollLayout(props: Props) {
  const sideAPhases = ['Dezesseis Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinais']
  const sideBPhasesReversed = ['Semifinais', 'Quartas de Final', 'Oitavas de Final', 'Dezesseis Avos de Final']
  const finalSlot = OFFICIAL_BRACKET_2026.find(s => s.fase === 'Final')
  const colWidth = 130

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }} className="-mx-1 px-1">
      <div className="flex gap-2.5 pb-2" style={{ minWidth: 'max-content' }}>
        {sideAPhases.map(phase => <PhaseColumn key={'A-' + phase} side="A" phase={phase} colWidth={colWidth} {...props}/>)}
        <div className="flex flex-col gap-2 flex-shrink-0" style={{ width: colWidth }}>
          <p className="text-[8.5px] font-semibold text-[#0099CC] uppercase tracking-wide text-center">Final</p>
          <div className="flex flex-col justify-center flex-1">
            {finalSlot && <SlotBox slot={finalSlot} colWidth={colWidth} {...props}/>}
          </div>
        </div>
        {sideBPhasesReversed.map(phase => <PhaseColumn key={'B-' + phase} side="B" phase={phase} colWidth={colWidth} {...props}/>)}
      </div>
    </div>
  )
}

// Visão expandida — Lado A e Lado B em duas faixas empilhadas (4 colunas
// cada, em vez de 8 lado a lado), com a Final centralizada entre elas.
// Pensada pra caber na largura da tela sem precisar arrastar pro lado.
function StackedLayout(props: Props) {
  const phasesInOrder = ['Dezesseis Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinais']
  const finalSlot = OFFICIAL_BRACKET_2026.find(s => s.fase === 'Final')
  const colWidth = 88

  return (
    <div className="space-y-5">
      {finalSlot && (
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-semibold text-[#0099CC] uppercase tracking-wide mb-2">Final</p>
          <SlotBox slot={finalSlot} colWidth={140} {...props}/>
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold text-gray-600 mb-2">Lado A</p>
        <div className="flex gap-2 justify-between" style={{ overflowX: 'auto' }}>
          {phasesInOrder.map(phase => <PhaseColumn key={'sA-' + phase} side="A" phase={phase} colWidth={colWidth} {...props}/>)}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold text-gray-600 mb-2">Lado B</p>
        <div className="flex gap-2 justify-between" style={{ overflowX: 'auto' }}>
          {phasesInOrder.map(phase => <PhaseColumn key={'sB-' + phase} side="B" phase={phase} colWidth={colWidth} {...props}/>)}
        </div>
      </div>
    </div>
  )
}

// Modal de tela cheia com a chave empilhada (Lado A / Lado B) — exportado
// separadamente pra também poder ser aberto a partir de um gatilho externo
// (o botão flutuante na tela Campeão), não só pelo botão "Expandir" interno.
export function BracketFullscreenModal({ ctx, onClose, ...rest }: Props & { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <p className="text-[14px] font-bold text-gray-900">Chaveamento completo</p>
        <button onClick={onClose} aria-label="Fechar"
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="p-4">
        <StackedLayout ctx={ctx} {...rest}/>
      </div>
    </div>
  )
}

// Chave completa, estilo site oficial da FIFA. No card mostra a versão
// compacta com rolagem lateral; o botão de expandir abre em tela cheia
// com Lado A e Lado B empilhados, sem precisar arrastar.
export default function BracketChart(props: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div className="flex justify-end mb-1.5">
        <button onClick={() => setExpanded(true)} aria-label="Expandir chaveamento"
          className="flex items-center gap-1 text-[11px] font-semibold text-[#0099CC] px-2 py-1 rounded-lg hover:bg-[#0099CC]/10">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          Expandir
        </button>
      </div>

      <ScrollLayout {...props}/>

      {expanded && <BracketFullscreenModal {...props} onClose={() => setExpanded(false)}/>}
    </div>
  )
}
