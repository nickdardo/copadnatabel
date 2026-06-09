import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Pick, calcFactor, FACTOR_PTS, FACTOR_COLOR, FASE_ORDER } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { IconCheck, IconBall, IconArrowRight } from '@/components/Icons'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PickMap = Record<string, { home: string; away: string; saved: boolean }>
const ROUND_SIZE = 8

// Flag map — same as champion page
const FLAG: Record<string, string> = {
  'Albania':'🇦🇱','Alemanha':'🇩🇪','Argentina':'🇦🇷','Arábia Saudita':'🇸🇦',
  'Austrália':'🇦🇺','Áustria':'🇦🇹','Bélgica':'🇧🇪','Bolívia':'🇧🇴',
  'Brasil':'🇧🇷','Camarões':'🇨🇲','Canadá':'🇨🇦','Cazaquistão':'🇰🇿',
  'Chile':'🇨🇱','Colômbia':'🇨🇴','Coreia do Sul':'🇰🇷','Costa Rica':'🇨🇷',
  'Croácia':'🇭🇷','Dinamarca':'🇩🇰','Equador':'🇪🇨','Eslováquia':'🇸🇰',
  'Eslovênia':'🇸🇮','Espanha':'🇪🇸','Estados Unidos':'🇺🇸','França':'🇫🇷',
  'Geórgia':'🇬🇪','Honduras':'🇭🇳','Hungria':'🇭🇺','Inglaterra':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Irã':'🇮🇷','Iraque':'🇮🇶','Israel':'🇮🇱','Itália':'🇮🇹',
  'Jamaica':'🇯🇲','Japão':'🇯🇵','Marrocos':'🇲🇦','México':'🇲🇽',
  'Moçambique':'🇲🇿','Nigéria':'🇳🇬','Noruega':'🇳🇴','Nova Zelândia':'🇳🇿',
  'Países Baixos':'🇳🇱','Panamá':'🇵🇦','Paraguai':'🇵🇾','Peru':'🇵🇪',
  'Portugal':'🇵🇹','RD Congo':'🇨🇩','Romênia':'🇷🇴','Sérvia':'🇷🇸',
  'Senegal':'🇸🇳','Suécia':'🇸🇪','Suíça':'🇨🇭','Tchéquia':'🇨🇿',
  'Turquia':'🇹🇷','Uruguai':'🇺🇾','Venezuela':'🇻🇪',
}

function getFlag(team: string, fallback?: string) {
  return FLAG[team] || fallback || '🏳️'
}

export default function PicksPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [matches,     setMatches]     = useState<Match[]>([])
  const [picks,       setPicks]       = useState<PickMap>({})
  const [saving,      setSaving]      = useState<Record<string, boolean>>({})
  const [fetching,    setFetching]    = useState(true)
  const [activePhase, setActivePhase] = useState('')
  const [round,       setRound]       = useState(0)
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchSaved,  setBatchSaved]  = useState(false)

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  const fetchData = useCallback(async () => {
    if (!player) return
    const [{ data: mData }, { data: pData }] = await Promise.all([
      supabase.from('matches').select('*').order('sort_order'),
      supabase.from('picks').select('*').eq('player_id', player.id),
    ])
    const ms = (mData || []) as Match[]
    setMatches(ms)
    const pickMap: PickMap = {}
    ms.forEach(m => { pickMap[m.id] = { home: '', away: '', saved: false } });
    (pData || []).forEach((p: Pick) => {
      pickMap[p.match_id] = { home: String(p.pick_home), away: String(p.pick_away), saved: true }
    })
    setPicks(pickMap)
    const phases = FASE_ORDER.filter(f => ms.some(m => m.fase === f))
    const firstActive = phases.find(f =>
      ms.some(m => m.fase === f && (m.status === 'upcoming' || m.status === 'live'))
    ) || phases[0]
    setActivePhase(firstActive || '')
    setFetching(false)
  }, [player])

  useEffect(() => { fetchData() }, [fetchData])

  const phaseMatches = matches.filter(m => m.fase === activePhase)
  const isGroups = activePhase === 'Fase de Grupos'
  const rounds: Match[][] = isGroups
    ? Array.from({ length: Math.ceil(phaseMatches.length / ROUND_SIZE) }, (_, i) =>
        phaseMatches.slice(i * ROUND_SIZE, (i + 1) * ROUND_SIZE))
    : [phaseMatches]
  const totalRounds  = rounds.length
  const currentRound = rounds[Math.min(round, totalRounds - 1)] || []
  const safeRound    = Math.min(round, totalRounds - 1)

  const isLocked = (m: Match) =>
    m.status === 'done' || m.status === 'live' ||
    (m.match_date ? isPast(parseISO(m.match_date)) : false)

  function roundStats(r: Match[]) {
    const unlocked = r.filter(m => !isLocked(m))
    const filled   = unlocked.filter(m => { const p = picks[m.id]; return p && p.home !== '' && p.away !== '' })
    return { total: unlocked.length, filled: filled.length }
  }

  function updatePick(matchId: string, side: 'home' | 'away', val: string) {
    const num = val.replace(/\D/g, '').slice(0, 2)
    setPicks(p => ({ ...p, [matchId]: { ...p[matchId], [side]: num, saved: false } }))
  }

  async function savePick(match: Match) {
    if (!player) return
    const pick = picks[match.id]
    if (pick.home === '' || pick.away === '') return
    setSaving(s => ({ ...s, [match.id]: true }))
    await supabase.from('picks').upsert({
      player_id: player.id, match_id: match.id,
      pick_home: Number(pick.home), pick_away: Number(pick.away),
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'player_id,match_id' })
    setSaving(s => ({ ...s, [match.id]: false }))
    setPicks(p => ({ ...p, [match.id]: { ...p[match.id], saved: true } }))
  }

  async function saveAllRound() {
    if (!player) return
    const toSave = currentRound.filter(m => {
      const p = picks[m.id]
      return !isLocked(m) && p && p.home !== '' && p.away !== ''
    })
    if (!toSave.length) return
    setBatchSaving(true)
    await Promise.all(toSave.map(m =>
      supabase.from('picks').upsert({
        player_id: player.id, match_id: m.id,
        pick_home: Number(picks[m.id].home), pick_away: Number(picks[m.id].away),
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'player_id,match_id' })
    ))
    setPicks(p => {
      const next = { ...p }
      toSave.forEach(m => { next[m.id] = { ...next[m.id], saved: true } })
      return next
    })
    setBatchSaving(false); setBatchSaved(true)
    setTimeout(() => setBatchSaved(false), 2500)
  }

  function goNext() { if (round < totalRounds-1) { setRound(r=>r+1); window.scrollTo({top:0,behavior:'smooth'}) } }
  function goPrev() { if (round > 0)             { setRound(r=>r-1); window.scrollTo({top:0,behavior:'smooth'}) } }
  function changePhase(f: string) { setActivePhase(f); setRound(0); setBatchSaved(false); window.scrollTo({top:0,behavior:'smooth'}) }

  const phases = FASE_ORDER.filter(f => matches.some(m => m.fase === f))
  const stats  = roundStats(currentRound)

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  return (
    <Layout title="Palpites">
      <div className="max-w-lg mx-auto px-4 py-4">

        {/* Phase tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{scrollbarWidth:'none'}}>
          {phases.map(f => {
            const hasLive = matches.some(m => m.fase === f && m.status === 'live')
            return (
              <button key={f} onClick={() => changePhase(f)}
                className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all flex items-center gap-1.5
                  ${activePhase === f ? 'bg-[#0099CC] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {hasLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                {f === 'Fase de Grupos' ? 'Grupos' : f}
              </button>
            )
          })}
        </div>

        {/* Round nav (groups only) */}
        {isGroups && totalRounds > 1 && (
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-bold text-gray-800">
                Rodada {safeRound + 1}
                <span className="text-gray-400 font-medium"> / {totalRounds}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">{stats.filled}/{stats.total} preenchidos</span>
                <div className="flex gap-1">
                  {rounds.map((r, i) => {
                    const s = roundStats(r)
                    const done = s.total > 0 && s.filled === s.total
                    return (
                      <button key={i} onClick={() => { setRound(i); window.scrollTo({top:0,behavior:'smooth'}) }}
                        className={`h-2 rounded-full transition-all ${i === safeRound ? 'w-5 bg-[#0099CC]' : done ? 'w-2 bg-green-400' : 'w-2 bg-gray-200'}`} />
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full transition-all"
                style={{ width: stats.total > 0 ? `${Math.round((stats.filled/stats.total)*100)}%` : '0%',
                         background: stats.filled === stats.total && stats.total > 0 ? '#22c55e' : '#0099CC' }} />
            </div>
            <div className="flex items-center justify-between">
              <button onClick={goPrev} disabled={safeRound === 0}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 disabled:opacity-30 hover:text-gray-700 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                Anterior
              </button>
              {safeRound < totalRounds - 1 ? (
                <button onClick={goNext} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC] hover:text-[#007aa8] transition-colors">
                  Próxima <IconArrowRight size={14} />
                </button>
              ) : (
                <span className="text-[12px] text-gray-400">Última rodada</span>
              )}
            </div>
          </div>
        )}

        {/* Match cards */}
        <div className="space-y-3">
          {currentRound.map(m => {
            const pick   = picks[m.id] || { home:'', away:'', saved:false }
            const locked = isLocked(m)
            const factor = m.status === 'done' && m.score_home !== undefined && pick.home !== ''
              ? calcFactor(Number(pick.home), Number(pick.away), m.score_home!, m.score_away!)
              : null

            // Use flag from DB field first, fallback to FLAG map
            const homeFlag = m.home_flag && m.home_flag !== '🏳️' ? m.home_flag : getFlag(m.home_team, m.home_flag)
            const awayFlag = m.away_flag && m.away_flag !== '🏳️' ? m.away_flag : getFlag(m.away_team, m.away_flag)

            return (
              <div key={m.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                {/* Status bar */}
                <div className={`px-4 py-2 flex items-center justify-between text-[11px]
                  ${m.status === 'live' ? 'bg-red-50' : m.status === 'done' ? 'bg-gray-50' : 'bg-blue-50/50'}`}>
                  <div className="flex items-center gap-2">
                    {m.status === 'live' && (
                      <span className="flex items-center gap-1.5 font-semibold text-red-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Ao vivo
                      </span>
                    )}
                    {m.status === 'done' && <span className="font-medium text-gray-500">Encerrado</span>}
                    {m.status === 'upcoming' && m.match_date && (
                      <span className="text-gray-400 font-medium">
                        {format(parseISO(m.match_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  {factor && (
                    <span className={`px-2 py-0.5 rounded-md font-bold ${FACTOR_COLOR[factor]}`}>
                      +{FACTOR_PTS[factor]}pts · {factor}
                    </span>
                  )}
                  {!locked && pick.saved && !factor && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <IconCheck size={11} /> Salvo
                    </span>
                  )}
                </div>

                {/* Match body */}
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between gap-2">

                    {/* Home team */}
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-3xl leading-none">{homeFlag}</span>
                      <span className="text-[12px] font-semibold text-gray-700 text-center leading-tight">
                        {m.home_team}
                      </span>
                    </div>

                    {/* Score inputs */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {locked ? (
                        <>
                          <div className={`w-13 h-13 w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border
                            ${pick.home !== '' ? 'bg-gray-50 text-gray-800 border-gray-200' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                            {pick.home !== '' ? pick.home : '–'}
                          </div>
                          <span className="text-gray-300 text-lg font-light">×</span>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border
                            ${pick.away !== '' ? 'bg-gray-50 text-gray-800 border-gray-200' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                            {pick.away !== '' ? pick.away : '–'}
                          </div>
                        </>
                      ) : (
                        <>
                          <input type="number" min="0" max="20" inputMode="numeric"
                            className="w-12 h-12 text-center text-xl font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC]"
                            value={pick.home} onChange={e => updatePick(m.id,'home',e.target.value)} placeholder="0" />
                          <span className="text-gray-300 text-lg font-light">×</span>
                          <input type="number" min="0" max="20" inputMode="numeric"
                            className="w-12 h-12 text-center text-xl font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC]"
                            value={pick.away} onChange={e => updatePick(m.id,'away',e.target.value)} placeholder="0" />
                        </>
                      )}
                    </div>

                    {/* Away team */}
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-3xl leading-none">{awayFlag}</span>
                      <span className="text-[12px] font-semibold text-gray-700 text-center leading-tight">
                        {m.away_team}
                      </span>
                    </div>
                  </div>

                  {/* Official result */}
                  {m.status === 'done' && m.score_home !== undefined && (
                    <div className="mt-3 text-center">
                      <span className="text-[11px] text-gray-400">
                        Resultado: <strong className="text-gray-600">{m.score_home} × {m.score_away}</strong>
                      </span>
                    </div>
                  )}

                  {/* Save button */}
                  {!locked && (
                    <button onClick={() => savePick(m)}
                      disabled={saving[m.id] || pick.home === '' || pick.away === ''}
                      className={`mt-3 w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5
                        ${pick.saved
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-[#0099CC]/10 text-[#0099CC] border border-[#0099CC]/20 hover:bg-[#0099CC]/20 disabled:opacity-40 disabled:cursor-not-allowed'}`}>
                      {saving[m.id]
                        ? <span className="w-4 h-4 border-2 border-[#0099CC]/30 border-t-[#0099CC] rounded-full animate-spin" />
                        : pick.saved
                          ? <><IconCheck size={13} /> Salvo</>
                          : 'Salvar palpite'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {currentRound.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <IconBall size={22} className="text-gray-300" />
              </div>
              <p className="text-[13px] text-gray-400">Nenhuma partida nesta fase ainda.</p>
            </div>
          )}
        </div>

        {/* Save all CTA */}
        {currentRound.some(m => !isLocked(m)) && (
          <div className="mt-5 space-y-3">
            <button onClick={saveAllRound} disabled={batchSaving || stats.filled === 0}
              className={`w-full py-3.5 rounded-xl font-semibold text-[15px] transition-all flex items-center justify-center gap-2 active:scale-[.98]
                ${batchSaved
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-[#0099CC] text-white hover:bg-[#007aa8] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm'}`}>
              {batchSaving
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : batchSaved
                  ? <><IconCheck size={18} /> Todos salvos!</>
                  : <>Salvar todos ({stats.filled}/{stats.total})</>}
            </button>
            {isGroups && safeRound < totalRounds - 1 && (
              <button onClick={goNext}
                className="w-full py-3 rounded-xl font-semibold text-[14px] text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                Próxima rodada <IconArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
