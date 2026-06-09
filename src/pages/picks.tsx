import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Pick, calcFactor, FACTOR_PTS, FACTOR_COLOR, FASE_ORDER, EditLimit } from '@/lib/supabase'
import Layout from '@/components/Layout'
import FlagImg from '@/components/FlagImg'
import { format, parseISO, subHours, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PickMap  = Record<string, { home: string; away: string; saved: boolean; editCount: number }>
type LimitMap = Record<string, EditLimit>
const ROUND_SIZE = 8
const MAX_EDITS  = 5
const LOCK_HOURS = 5 // hours before match to lock picks

// SVG icons
const IcoCheck  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoBall   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
const IcoLock   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IcoArrowL = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
const IcoArrowR = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18"/></svg>

// Convert UTC date to BRT (UTC-3) for display
function toBRT(dateStr: string): Date {
  const d = parseISO(dateStr)
  return new Date(d.getTime() - 0) // keep as-is, format with BRT offset
}

function formatBRT(dateStr: string, fmt: string): string {
  // Add -3h offset to display as BRT
  const d = parseISO(dateStr)
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  return format(brt, fmt, { locale: ptBR })
}

export default function PicksPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [matches,     setMatches]     = useState<Match[]>([])
  const [picks,       setPicks]       = useState<PickMap>({})
  const [limits,      setLimits]      = useState<LimitMap>({})
  const [saving,      setSaving]      = useState(false)
  const [fetching,    setFetching]    = useState(true)
  const [activePhase, setActivePhase] = useState('')
  const [tab,         setTab]         = useState<'upcoming'|'live'|'done'>('upcoming')
  const [round,       setRound]       = useState(0)
  const [batchSaved,  setBatchSaved]  = useState(false)

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  const fetchData = useCallback(async () => {
    if (!player) return
    const [{ data: mData }, { data: pData }, { data: lData }] = await Promise.all([
      supabase.from('matches').select('*').order('sort_order'),
      supabase.from('picks').select('*').eq('player_id', player.id),
      supabase.from('pick_edit_limits').select('*').eq('player_id', player.id),
    ])
    const ms = (mData || []) as Match[]
    setMatches(ms)
    const pm: PickMap = {}
    ms.forEach(m => { pm[m.id] = { home: '', away: '', saved: false, editCount: 0 } });
    (pData || []).forEach((p: Pick) => {
      pm[p.match_id] = { home: String(p.pick_home), away: String(p.pick_away), saved: true, editCount: p.edit_count || 0 }
    })
    setPicks(pm)
    const lm: LimitMap = {}
    ;(lData || []).forEach((l: EditLimit) => { lm[`${l.fase}:${l.round_index}`] = l })
    setLimits(lm)
    const phases = FASE_ORDER.filter(f => ms.some(m => m.fase === f))
    const first = phases.find(f => ms.some(m => m.fase === f && (m.status === 'upcoming' || m.status === 'live'))) || phases[0]
    setActivePhase(first || '')
    setFetching(false)
  }, [player])

  useEffect(() => { fetchData() }, [fetchData])

  // Lock 5 hours before match start (BRT)
  const isLocked = (m: Match): boolean => {
    if (m.status === 'done' || m.status === 'live') return true
    if (!m.match_date) return false
    const lockTime = subHours(parseISO(m.match_date), LOCK_HOURS)
    return isBefore(lockTime, new Date())
  }

  const phaseMatches    = matches.filter(m => m.fase === activePhase)
  const isGroups        = activePhase === 'Fase de Grupos'
  const upcomingMatches = phaseMatches.filter(m => !isLocked(m))
  const liveMatches     = phaseMatches.filter(m => m.status === 'live')
  const doneMatches     = phaseMatches.filter(m => isLocked(m) && m.status !== 'live')

  const upcomingRounds = isGroups
    ? Array.from({ length: Math.ceil(upcomingMatches.length / ROUND_SIZE) }, (_, i) =>
        upcomingMatches.slice(i * ROUND_SIZE, (i + 1) * ROUND_SIZE))
    : [upcomingMatches]
  const safeRound    = Math.min(round, upcomingRounds.length - 1)
  const currentRound = upcomingRounds[safeRound] || []

  const tabMatches = tab === 'live' ? liveMatches : tab === 'done' ? doneMatches : currentRound

  const limitKey  = `${activePhase}:${safeRound}`
  const editLimit = limits[limitKey]
  const editsUsed = editLimit?.edits_used || 0
  const editsLeft = MAX_EDITS - editsUsed
  const roundLocked = editsLeft <= 0

  function updatePick(matchId: string, side: 'home' | 'away', val: string) {
    if (roundLocked) return
    setPicks(p => ({ ...p, [matchId]: { ...p[matchId], [side]: val.replace(/\D/g, '').slice(0, 2), saved: false } }))
  }

  async function confirmAll() {
    if (!player || saving) return
    const toSave = currentRound.filter(m => {
      const p = picks[m.id]; return !isLocked(m) && p && p.home !== '' && p.away !== ''
    })
    if (!toSave.length) return
    setSaving(true)
    const hasEdits = toSave.some(m => picks[m.id].saved)
    await Promise.all(toSave.map(m =>
      supabase.from('picks').upsert({
        player_id: player.id, match_id: m.id,
        pick_home: Number(picks[m.id].home), pick_away: Number(picks[m.id].away),
        submitted_at: new Date().toISOString(), edit_count: picks[m.id].editCount || 0,
      }, { onConflict: 'player_id,match_id' })
    ))
    if (hasEdits) {
      const newEdits = editsUsed + 1
      await supabase.from('pick_edit_limits').upsert({
        player_id: player.id, fase: activePhase, round_index: safeRound,
        edits_used: newEdits, max_edits: MAX_EDITS,
      }, { onConflict: 'player_id,fase,round_index' })
      setLimits(l => ({ ...l, [limitKey]: { ...editLimit || { player_id: player.id, fase: activePhase, round_index: safeRound, max_edits: MAX_EDITS }, edits_used: newEdits } }))
    }
    setPicks(p => { const n = { ...p }; toSave.forEach(m => { n[m.id] = { ...n[m.id], saved: true } }); return n })
    setSaving(false); setBatchSaved(true)
  }

  // Group matches by date for display
  function groupByDate(ms: Match[]) {
    const groups: Record<string, Match[]> = {}
    ms.forEach(m => {
      const key = m.match_date ? formatBRT(m.match_date, 'EEE., dd/MM') : 'Data a definir'
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })
    return groups
  }

  const phases = FASE_ORDER.filter(f => matches.some(m => m.fase === f))
  const filled = tabMatches.filter(m => { const p = picks[m.id]; return p && p.home !== '' && p.away !== '' }).length

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  const groupedMatches = tab === 'upcoming' ? groupByDate(currentRound) : groupByDate(tabMatches)

  return (
    <Layout title="Palpites">
      <div className="max-w-lg mx-auto px-4 pt-5">
        <div className="text-center mb-4">
          <h1 className="text-[18px] font-bold text-gray-900">Palpites</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Bolão dnata · Copa do Mundo 2026</p>
        </div>

        {/* Phase tabs */}
        {phases.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
            {phases.map(f => (
              <button key={f} onClick={() => { setActivePhase(f); setRound(0); setTab('upcoming'); setBatchSaved(false) }}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${activePhase === f ? 'bg-[#0099CC] text-white' : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                {f === 'Fase de Grupos' ? 'Grupos' : f}
              </button>
            ))}
          </div>
        )}

        {/* Status tabs */}
        <div className="flex bg-white border border-gray-100 rounded-2xl p-1.5 mb-4 shadow-sm">
          {([['live', 'Ao vivo', liveMatches.length], ['upcoming', 'Próximos', upcomingMatches.length], ['done', 'Encerrados', doneMatches.length]] as [typeof tab, string, number][]).map(([key, label, count]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 relative flex items-center justify-center gap-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${tab === key ? 'bg-[#0099CC] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {label}
              {count > 0 && <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${tab === key ? 'bg-white/25 text-white' : 'bg-amber-400 text-white'}`}>{count > 9 ? '9+' : count}</span>}
            </button>
          ))}
        </div>

        {/* Round nav */}
        {tab === 'upcoming' && isGroups && upcomingRounds.length > 1 && (
          <div className="flex items-center justify-between mb-3 px-1">
            <button onClick={() => { if (safeRound > 0) { setRound(r => r - 1); setBatchSaved(false) } }} disabled={safeRound === 0}
              className="flex items-center gap-1 text-[12px] font-semibold text-gray-400 disabled:opacity-30 hover:text-gray-600 transition-colors">
              <IcoArrowL /> Anterior
            </button>
            <div className="text-center">
              <span className="text-[12px] text-gray-600 font-bold">Rodada {safeRound + 1} / {upcomingRounds.length}</span>
              {editsUsed > 0 && (
                <span className={`ml-2 text-[11px] font-semibold ${editsLeft === 0 ? 'text-red-500' : editsLeft <= 2 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {editsLeft}/{MAX_EDITS} alt.
                </span>
              )}
            </div>
            <button onClick={() => { if (safeRound < upcomingRounds.length - 1) { setRound(r => r + 1); setBatchSaved(false) } }} disabled={safeRound === upcomingRounds.length - 1}
              className="flex items-center gap-1 text-[12px] font-semibold text-[#0099CC] disabled:opacity-30 hover:text-[#007aa8] transition-colors">
              Próxima <IcoArrowR />
            </button>
          </div>
        )}

        {/* Lock warning */}
        {tab === 'upcoming' && roundLocked && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <IcoLock /><span className="text-[12px] text-red-700 font-medium">Limite de alterações atingido para esta rodada.</span>
          </div>
        )}
        {tab === 'upcoming' && !roundLocked && editsLeft <= 2 && editsUsed > 0 && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <IcoLock /><span className="text-[12px] text-amber-700 font-medium">Atenção! Apenas <strong>{editsLeft}</strong> alteração{editsLeft === 1 ? '' : 'ões'} restante{editsLeft === 1 ? '' : 's'} nesta rodada.</span>
          </div>
        )}

        <p className="text-[12px] text-gray-400 text-center mb-4">
          {tab === 'upcoming' ? `Palpites fecham ${LOCK_HOURS}h antes de cada jogo` : tab === 'live' ? 'Jogos acontecendo agora.' : 'Resultados e seus palpites.'}
        </p>
      </div>

      {/* Matches grouped by date */}
      <div className="max-w-lg mx-auto px-4 space-y-1 pb-36">
        {Object.entries(groupedMatches).map(([dateLabel, dayMatches]) => (
          <div key={dateLabel}>
            {/* Date separator */}
            <div className="sticky top-14 z-10 bg-gray-100 border-y border-gray-200 px-4 py-2 flex items-center gap-2 mb-1">
              <span className="text-[12px] font-bold text-gray-600 uppercase tracking-wide">
                {activePhase === 'Fase de Grupos' ? 'Fase de grupos' : activePhase} · {dateLabel}
              </span>
            </div>

            {/* Matches grid — 2 columns on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              {dayMatches.map(m => {
                const pick   = picks[m.id] || { home: '', away: '', saved: false, editCount: 0 }
                const locked = isLocked(m) || (tab === 'upcoming' && roundLocked && pick.saved)
                const factor = m.status === 'done' && m.score_home !== undefined && pick.home !== ''
                  ? calcFactor(Number(pick.home), Number(pick.away), m.score_home!, m.score_away!) : null

                // Time in BRT
                const timeBRT = m.match_date ? formatBRT(m.match_date, 'HH:mm') : ''

                return (
                  <div key={m.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    {/* Card header */}
                    <div className={`px-3 py-1.5 flex items-center justify-between text-[10px] border-b ${m.status === 'live' ? 'bg-red-50 border-red-100' : m.status === 'done' ? 'bg-gray-50 border-gray-100' : 'bg-blue-50/50 border-blue-100/40'}`}>
                      <div className="flex items-center gap-1.5">
                        {m.status === 'live' && <span className="flex items-center gap-1 font-bold text-red-600"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>AO VIVO</span>}
                        {m.status === 'done' && <span className="font-medium text-gray-500">Encerrado</span>}
                        {m.status === 'upcoming' && <span className="font-semibold text-blue-600">{timeBRT}</span>}
                        {m.group_name && <span className="text-gray-400">· {m.group_name}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {factor && <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${FACTOR_COLOR[factor]}`}>+{FACTOR_PTS[factor]}pts {factor}</span>}
                        {!locked && pick.saved && !factor && <span className="flex items-center gap-0.5 text-green-600 font-semibold"><IcoCheck />Salvo</span>}
                        {locked && !m.match_date?.endsWith('Z') === false && m.status === 'upcoming' && (
                          <span className="flex items-center gap-0.5 text-amber-600 font-semibold"><IcoLock />Fechado</span>
                        )}
                      </div>
                    </div>

                    {/* Match body */}
                    <div className="px-3 py-4 flex items-center gap-2">
                      {/* Home */}
                      <div className="flex-1 flex flex-col items-center gap-1.5">
                        <FlagImg team={m.home_team} dbFlag={m.home_flag} size={44} />
                        <span className="text-[11px] font-bold text-gray-700 text-center leading-tight uppercase">{m.home_team}</span>
                      </div>

                      {/* Score inputs */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {locked ? (
                          <>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border-2 ${pick.home !== '' ? 'border-gray-200 bg-gray-50 text-gray-800' : 'border-gray-100 bg-gray-50 text-gray-300'}`}>{pick.home !== '' ? pick.home : '–'}</div>
                            <span className="text-gray-200 text-lg">×</span>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border-2 ${pick.away !== '' ? 'border-gray-200 bg-gray-50 text-gray-800' : 'border-gray-100 bg-gray-50 text-gray-300'}`}>{pick.away !== '' ? pick.away : '–'}</div>
                          </>
                        ) : (
                          <>
                            <input type="number" min="0" max="20" inputMode="numeric"
                              className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:border-[#0099CC] transition-colors"
                              value={pick.home} onChange={e => updatePick(m.id, 'home', e.target.value)} placeholder="0" />
                            <span className="text-gray-200 text-lg">×</span>
                            <input type="number" min="0" max="20" inputMode="numeric"
                              className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:border-[#0099CC] transition-colors"
                              value={pick.away} onChange={e => updatePick(m.id, 'away', e.target.value)} placeholder="0" />
                          </>
                        )}
                      </div>

                      {/* Away */}
                      <div className="flex-1 flex flex-col items-center gap-1.5">
                        <FlagImg team={m.away_team} dbFlag={m.away_flag} size={44} />
                        <span className="text-[11px] font-bold text-gray-700 text-center leading-tight uppercase">{m.away_team}</span>
                      </div>
                    </div>

                    {/* Official result */}
                    {m.status === 'done' && m.score_home !== undefined && (
                      <div className="pb-2 text-center">
                        <span className="text-[11px] text-gray-400">Resultado: <strong className="text-gray-600">{m.score_home} × {m.score_away}</strong></span>
                      </div>
                    )}

                    {/* Locked with no pick */}
                    {locked && pick.home === '' && m.status === 'upcoming' && (
                      <div className="pb-2.5 flex justify-center">
                        <span className="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          <IcoLock /> Palpite encerrado
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {Object.keys(groupedMatches).length === 0 && (
          <div className="text-center py-14">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-300"><IcoBall /></div>
            <p className="text-[13px] text-gray-400">
              {tab === 'live' ? 'Nenhum jogo ao vivo.' : tab === 'upcoming' ? 'Nenhum jogo disponível.' : 'Nenhum jogo encerrado ainda.'}
            </p>
          </div>
        )}
      </div>

      {/* Fixed bottom CTA */}
      {tab === 'upcoming' && currentRound.length > 0 && !roundLocked && (
        <div className="fixed bottom-16 left-0 right-0 z-20 px-4 pb-2">
          <div className="max-w-lg mx-auto space-y-2">

            {/* Edit limit card — shown after first save */}
            {batchSaved && (
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <IcoLock />
                  <div>
                    <p className="text-[12px] font-bold text-gray-700">
                      {editsLeft > 0 ? `${editsLeft} alteração${editsLeft === 1 ? '' : 'ões'} disponível${editsLeft === 1 ? '' : 'is'}` : 'Limite atingido'}
                    </p>
                    <p className="text-[11px] text-gray-400">Máx. {MAX_EDITS} trocas por rodada</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: MAX_EDITS }).map((_, i) => (
                    <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i < editsUsed ? 'bg-amber-400' : 'bg-gray-200'}`} />
                  ))}
                </div>
              </div>
            )}

            {/* CTA button */}
            <button
              onClick={batchSaved ? () => {} : confirmAll}
              disabled={saving || (!batchSaved && filled === 0)}
              className={`w-full py-4 rounded-2xl font-bold text-[15px] tracking-wide transition-all shadow-lg flex items-center justify-center gap-2
                ${batchSaved ? 'bg-gray-200 text-gray-500 cursor-default'
                  : saving ? 'bg-[#0099CC] text-white'
                  : filled > 0 ? 'bg-[#0099CC] text-white hover:bg-[#007aa8] active:scale-[.98]'
                  : 'bg-[#0099CC]/40 text-white/60 cursor-not-allowed'}`}>
              {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               : batchSaved ? (
                  <div className="flex items-center gap-2.5">
                    <IcoCheck /><span>PALPITES CONFIRMADOS</span>
                    <span className="bg-gray-400 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{editsLeft}/{MAX_EDITS} alt.</span>
                  </div>
                ) : filled > 0 ? `CONFIRMAR PALPITES (${filled})` : 'PREENCHA OS PLACARES'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
