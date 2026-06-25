import { useState, useEffect, useMemo } from 'react'
import { supabase, Match } from '@/lib/supabase'
import FlagImg from '@/components/FlagImg'
import { ALL_TEAMS_BY_GROUP_2026 } from '@/lib/groupStandings'

const KNOCKOUT_PHASES = ['Dezesseis Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinais', 'Final']
const PHASE_SHORT: Record<string, string> = {
  'Dezesseis Avos de Final': 'Dezesseis avos',
  'Oitavas de Final': 'Oitavas',
  'Quartas de Final': 'Quartas',
  'Semifinais': 'Semifinais',
  'Final': 'Final',
}

// Editor de chaveamento mata-mata — classifica cada confronto em Lado A
// ou Lado B (usado pelo CompetitionStatusCard pra mostrar o caminho de
// cada lado até a semifinal) e permite cadastrar manualmente um confronto
// que a Odds API ainda não publicou. odds_event_id null identifica um
// confronto manual; um confronto sincronizado nunca pode ser removido
// por aqui (ver delete-knockout-match.ts).
export default function BracketSideEditor() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState<string | null>(null)

  const allTeams = useMemo(
    () => Object.values(ALL_TEAMS_BY_GROUP_2026).flat().sort(),
    []
  )

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('matches').select('*').in('fase', KNOCKOUT_PHASES).order('sort_order')
    setMatches(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function setSide(matchId: string, side: 'A' | 'B') {
    setSavingId(matchId)
    setErrMsg(null)
    try {
      const res = await fetch('/api/admin/set-bracket-side', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, bracket_side: side }),
      })
      if (res.ok) await load()
      else { const j = await res.json(); setErrMsg(j.error || 'Erro ao salvar.') }
    } catch { setErrMsg('Erro de conexão.') }
    setSavingId(null)
  }

  async function deleteMatch(matchId: string) {
    if (!confirm('Remover este confronto cadastrado manualmente?')) return
    setSavingId(matchId)
    setErrMsg(null)
    try {
      const res = await fetch('/api/admin/delete-knockout-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId }),
      })
      if (res.ok) await load()
      else { const j = await res.json(); setErrMsg(j.error || 'Erro ao remover.') }
    } catch { setErrMsg('Erro de conexão.') }
    setSavingId(null)
  }

  const byPhase: Record<string, Match[]> = {}
  KNOCKOUT_PHASES.forEach(p => { byPhase[p] = matches.filter(m => m.fase === p) })

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-[13px] font-bold text-gray-800">Chaveamento mata-mata — Lado A / Lado B</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
          Classifique cada confronto eliminatório em Lado A ou Lado B (a Final não precisa — é onde os
          dois lados se encontram). Se a Odds API ainda não publicou um confronto, cadastre manualmente
          abaixo; quando ela sincronizar o jogo de verdade, ele aparece separado — sem duplicar, então
          se isso acontecer, remova a versão manual depois.
        </p>
      </div>

      {errMsg && <p className="text-[12px] font-medium text-red-600">{errMsg}</p>}
      {loading && <p className="text-[12px] text-gray-400">Carregando...</p>}

      {!loading && KNOCKOUT_PHASES.map(phase => (
        <div key={phase} className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{PHASE_SHORT[phase]}</p>
            <button onClick={() => setShowCreate(showCreate === phase ? null : phase)}
              className="text-[10px] font-semibold text-[#0099CC] hover:underline">
              {showCreate === phase ? 'Cancelar' : '+ Cadastrar confronto'}
            </button>
          </div>

          {showCreate === phase && (
            <CreateMatchForm phase={phase} allTeams={allTeams} onCreated={() => { setShowCreate(null); load() }}/>
          )}

          <div className="space-y-1.5 mt-2">
            {byPhase[phase].length === 0 && (
              <p className="text-[11px] text-gray-400 px-1">Nenhum confronto cadastrado ainda</p>
            )}
            {byPhase[phase].map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[12px] text-gray-800">
                    <FlagImg team={m.home_team} size={14}/><span className="truncate">{m.home_team}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-gray-800 mt-0.5">
                    <FlagImg team={m.away_team} size={14}/><span className="truncate">{m.away_team}</span>
                  </div>
                </div>
                {phase !== 'Final' && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setSide(m.id, 'A')} disabled={savingId === m.id}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors ${m.bracket_side === 'A' ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500'}`}>A</button>
                    <button onClick={() => setSide(m.id, 'B')} disabled={savingId === m.id}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors ${m.bracket_side === 'B' ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500'}`}>B</button>
                  </div>
                )}
                {!m.odds_event_id && (
                  <button onClick={() => deleteMatch(m.id)} disabled={savingId === m.id}
                    aria-label="Remover confronto manual"
                    className="text-gray-300 hover:text-red-500 flex-shrink-0 disabled:opacity-30">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CreateMatchForm({ phase, allTeams, onCreated }: { phase: string; allTeams: string[]; onCreated: () => void }) {
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [side, setSide] = useState<'A' | 'B'>('A')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function create() {
    if (!home || !away || home === away) { setErr('Escolha dois times diferentes.'); return }
    setSaving(true); setErr(null)
    try {
      const res = await fetch('/api/admin/create-knockout-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fase: phase, home_team: home, away_team: away,
          bracket_side: phase === 'Final' ? null : side,
          match_date: date || null,
        }),
      })
      if (res.ok) onCreated()
      else { const j = await res.json(); setErr(j.error || 'Erro ao criar.') }
    } catch { setErr('Erro de conexão.') }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-lg p-2.5 mb-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={home} onChange={e => setHome(e.target.value)} className="text-[11px] border border-gray-200 rounded-md px-2 py-1.5">
          <option value="">Time da casa</option>
          {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={away} onChange={e => setAway(e.target.value)} className="text-[11px] border border-gray-200 rounded-md px-2 py-1.5">
          <option value="">Time visitante</option>
          {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex gap-2 items-center">
        <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
          className="text-[11px] border border-gray-200 rounded-md px-2 py-1.5 flex-1"/>
        {phase !== 'Final' && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => setSide('A')} className={`text-[10px] font-semibold px-2 py-1.5 rounded-md ${side === 'A' ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500'}`}>Lado A</button>
            <button onClick={() => setSide('B')} className={`text-[10px] font-semibold px-2 py-1.5 rounded-md ${side === 'B' ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500'}`}>Lado B</button>
          </div>
        )}
      </div>
      {err && <p className="text-[10px] text-red-600">{err}</p>}
      <button onClick={create} disabled={saving}
        className="w-full bg-[#0099CC] text-white text-[11px] font-semibold py-1.5 rounded-md disabled:opacity-50">
        {saving ? 'Salvando...' : 'Criar confronto'}
      </button>
    </div>
  )
}
