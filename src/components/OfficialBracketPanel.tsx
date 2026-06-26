import { useState, useEffect, useMemo } from 'react'
import { supabase, Match } from '@/lib/supabase'
import FlagImg from '@/components/FlagImg'
import {
  OFFICIAL_BRACKET_2026, buildBracketContext, resolveSlot,
  type OfficialSlot,
} from '@/lib/officialBracket2026'

const PHASE_SHORT: Record<string, string> = {
  'Dezesseis Avos de Final': 'Dezesseis avos',
  'Oitavas de Final': 'Oitavas',
  'Quartas de Final': 'Quartas',
  'Semifinais': 'Semifinais',
}

// Painel automático do chaveamento — usa a estrutura oficial da FIFA
// (lib/officialBracket2026.ts) pra ir resolvendo os times de cada confronto
// conforme a classificação dos grupos e os próprios jogos do mata-mata vão
// terminando. O admin só confirma e cria o confronto real quando os dois
// times de um jogo já são conhecidos. Fica lado a lado com o editor manual
// (BracketSideEditor) — pra qualquer confronto que a fórmula automática não
// resolva sozinha (ex: empate técnico real entre 3os colocados).
export default function OfficialBracketPanel() {
  const [matches, setMatches] = useState<Match[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [side, setSide] = useState<'A' | 'B'>('A')
  const [creatingMatch, setCreatingMatch] = useState<number | null>(null)
  const [pickedThird, setPickedThird] = useState<Record<number, string>>({})
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: m }, { data: o }] = await Promise.all([
      supabase.from('matches').select('*'),
      supabase.from('team_group_overrides').select('team_name, group_label'),
    ])
    setMatches(m || [])
    const map: Record<string, string> = {}
    ;(o || []).forEach((r: { team_name: string; group_label: string }) => { map[r.team_name] = r.group_label })
    setOverrides(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const ctx = useMemo(() => buildBracketContext(matches, overrides), [matches, overrides])

  async function createMatch(slot: OfficialSlot, homeTeam: string, awayTeam: string) {
    setCreatingMatch(slot.match)
    setErrMsg(null)
    try {
      const res = await fetch('/api/admin/create-knockout-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fase: slot.fase, home_team: homeTeam, away_team: awayTeam,
          bracket_side: slot.side, match_date: slot.dateHint || null,
          official_match_number: slot.match,
        }),
      })
      if (res.ok) await load()
      else { const j = await res.json(); setErrMsg(j.error || 'Erro ao criar.') }
    } catch { setErrMsg('Erro de conexão.') }
    setCreatingMatch(null)
  }

  function renderSlot(slot: OfficialSlot) {
    const existing = ctx.matchesByOfficialNumber[slot.match]
    const home = resolveSlot(slot.home, ctx.standingsByGroup, ctx.top8Thirds, ctx.matchesByOfficialNumber)
    const away = resolveSlot(slot.away, ctx.standingsByGroup, ctx.top8Thirds, ctx.matchesByOfficialNumber)

    if (existing) {
      return (
        <div key={slot.match} className="bg-white rounded-lg border border-green-100 px-2.5 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold text-green-600">Jogo {slot.match} · cadastrado ✓</span>
            <span className="text-[9px] text-gray-400">{existing.status === 'done' ? 'Encerrado' : existing.status === 'live' ? 'Ao vivo' : 'Agendado'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-gray-800"><FlagImg team={existing.home_team} size={14}/><span className="truncate">{existing.home_team}</span></div>
          <div className="flex items-center gap-1.5 text-[12px] text-gray-800 mt-0.5"><FlagImg team={existing.away_team} size={14}/><span className="truncate">{existing.away_team}</span></div>
        </div>
      )
    }

    const homeTeam = home.candidates && home.candidates.length > 1 ? pickedThird[slot.match * 10 + 1] : home.team
    const awayTeam = away.candidates && away.candidates.length > 1 ? pickedThird[slot.match * 10 + 2] : away.team
    const bothKnown = !!homeTeam && !!awayTeam

    return (
      <div key={slot.match} className="bg-white rounded-lg border border-gray-100 px-2.5 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-semibold text-[#0099CC]">Jogo {slot.match}</span>
          <span className="text-[9px] text-gray-400">{slot.venue}</span>
        </div>

        {home.candidates && home.candidates.length > 1 ? (
          <select value={pickedThird[slot.match * 10 + 1] || ''} onChange={e => setPickedThird(p => ({ ...p, [slot.match * 10 + 1]: e.target.value }))}
            className="w-full text-[11px] border border-amber-200 bg-amber-50 rounded-md px-1.5 py-1 mb-0.5">
            <option value="">{home.label} — escolha</option>
            {home.candidates.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <div className={`flex items-center gap-1.5 text-[12px] ${home.resolved ? 'text-gray-800' : 'text-gray-400'} mb-0.5`}>
            {home.resolved && home.team ? <FlagImg team={home.team} size={14}/> : null}
            <span className="truncate">{home.team || home.label}</span>
          </div>
        )}

        {away.candidates && away.candidates.length > 1 ? (
          <select value={pickedThird[slot.match * 10 + 2] || ''} onChange={e => setPickedThird(p => ({ ...p, [slot.match * 10 + 2]: e.target.value }))}
            className="w-full text-[11px] border border-amber-200 bg-amber-50 rounded-md px-1.5 py-1">
            <option value="">{away.label} — escolha</option>
            {away.candidates.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <div className={`flex items-center gap-1.5 text-[12px] ${away.resolved ? 'text-gray-800' : 'text-gray-400'}`}>
            {away.resolved && away.team ? <FlagImg team={away.team} size={14}/> : null}
            <span className="truncate">{away.team || away.label}</span>
          </div>
        )}

        {bothKnown && (
          <button onClick={() => createMatch(slot, homeTeam!, awayTeam!)} disabled={creatingMatch === slot.match}
            className="w-full mt-2 bg-[#0099CC] text-white text-[10.5px] font-semibold py-1.5 rounded-md disabled:opacity-50">
            {creatingMatch === slot.match ? 'Criando...' : '+ Criar confronto real'}
          </button>
        )}
      </div>
    )
  }

  const sideSlots = OFFICIAL_BRACKET_2026.filter(s => s.side === side)
  const phasesInOrder = ['Dezesseis Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinais']
  const unsidedSlots = OFFICIAL_BRACKET_2026.filter(s => s.side === null)

  return (
    <div className="bg-white border border-green-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-[13px] font-bold text-gray-800">Chaveamento automático — oficial FIFA 2026</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
          Resolve os confrontos sozinho, usando a classificação dos grupos e os jogos do mata-mata já encerrados.
          O 3º colocado é calculado só por pontos/saldo/gols (sem critério de fair play da FIFA). Em caso de mais
          de um candidato possível, escolha manualmente. Clique em "Criar confronto real" quando os dois times
          já estiverem definidos.
        </p>
      </div>

      {errMsg && <p className="text-[12px] font-medium text-red-600">{errMsg}</p>}
      {loading && <p className="text-[12px] text-gray-400">Carregando...</p>}

      {!loading && (
        <>
          <div className="flex gap-2">
            <button onClick={() => setSide('A')} className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold ${side === 'A' ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500'}`}>Lado A</button>
            <button onClick={() => setSide('B')} className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold ${side === 'B' ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500'}`}>Lado B</button>
          </div>

          {phasesInOrder.map(phase => {
            const slots = sideSlots.filter(s => s.fase === phase)
            if (slots.length === 0) return null
            return (
              <div key={phase} className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">{PHASE_SHORT[phase]}</p>
                <div className="space-y-1.5">{slots.map(renderSlot)}</div>
              </div>
            )
          })}

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Final · 3º lugar</p>
            <div className="space-y-1.5">{unsidedSlots.map(renderSlot)}</div>
          </div>
        </>
      )}
    </div>
  )
}
