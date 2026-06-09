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

type Tab = 'upcoming' | 'live' | 'done'

export default function PicksPage() {
  const { player, loading } = useAuth()
  const router = useRouter()

  const [matches,     setMatches]     = useState<Match[]>([])
  const [picks,       setPicks]       = useState<PickMap>({})
  const [saving,      setSaving]      = useState(false)
  const [fetching,    setFetching]    = useState(true)
  const [activePhase, setActivePhase] = useState('')
  const [tab,         setTab]         = useState<Tab>('upcoming')
  const [round,       setRound]       = useState(0)
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
    const firstActive = phases.find(f => ms.some(m => m.fase === f && (m.status === 'upcoming' || m.status === 'live'))) || phases[0]
    setActivePhase(firstActive || '')
    setFetching(false)
  }, [player])

  useEffect(() => { fetchData() }, [fetchData])

  const isLocked = (m: Match) =>
    m.status === 'done' || m.status === 'live' ||
    (m.match_date ? isPast(parseISO(m.match_date)) : false)

  // Filter by tab
  const phaseMatches  = matches.filter(m => m.fase === activePhase)
  const liveMatches   = phaseMatches.filter(m => m.status === 'live')
  const upcomingMatches = phaseMatches.filter(m => m.status === 'upcoming' && !isPast(parseISO(m.match_date || '')))
  const doneMatches   = phaseMatches.filter(m => m.status === 'done' || (m.match_date && isPast(parseISO(m.match_date)) && m.status !== 'live'))

  const isGroups = activePhase === 'Fase de Grupos'
  const ROUND_SIZE_UPCOMING = 8

  // For upcoming, show in rounds
  const upcomingRounds = isGroups
    ? Array.from({ length: Math.ceil(upcomingMatches.length / ROUND_SIZE_UPCOMING) }, (_, i) =>
        upcomingMatches.slice(i * ROUND_SIZE_UPCOMING, (i + 1) * ROUND_SIZE_UPCOMING))
    : [upcomingMatches]
  const safeRound    = Math.min(round, upcomingRounds.length - 1)
  const currentRound = upcomingRounds[safeRound] || []

  const tabMatches: Match[] =
    tab === 'live'     ? liveMatches :
    tab === 'done'     ? doneMatches :
    currentRound

  function updatePick(matchId: string, side: 'home' | 'away', val: string) {
    const num = val.replace(/\D/g, '').slice(0, 2)
    setPicks(p => ({ ...p, [matchId]: { ...p[matchId], [side]: num, saved: false } }))
  }

  // Count filled upcoming picks for CTA
  const filledCount = tabMatches.filter(m => {
    const p = picks[m.id]; return p && p.home !== '' && p.away !== ''
  }).length

  async function confirmAll() {
    if (!player || filledCount === 0) return
    setSaving(true)
    const toSave = tabMatches.filter(m => {
      const p = picks[m.id]; return !isLocked(m) && p && p.home !== '' && p.away !== ''
    })
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
    setSaving(false); setBatchSaved(true)
    setTimeout(() => setBatchSaved(false), 3000)
  }

  const phases = FASE_ORDER.filter(f => matches.some(m => m.fase === f))

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  const tabConfig: { key: Tab; label: string; count: number }[] = [
    { key: 'live',     label: 'Ao vivo',    count: liveMatches.length },
    { key: 'upcoming', label: 'Próximos',   count: upcomingMatches.length },
    { key: 'done',     label: 'Definidos',  count: doneMatches.length },
  ]

  return (
    <Layout title="Palpites">
      {/* Sticky header inside layout */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-2">

        {/* Title */}
        <div className="text-center mb-5">
          <h1 className="text-[18px] font-bold text-gray-900">Palpites</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Área de palpites das partidas disponíveis.</p>
        </div>

        {/* Phase tabs — compact */}
        {phases.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4" style={{scrollbarWidth:'none'}}>
            {phases.map(f => (
              <button key={f} onClick={() => { setActivePhase(f); setRound(0); setTab('upcoming') }}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all
                  ${activePhase === f ? 'bg-[#0099CC] text-white' : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                {f === 'Fase de Grupos' ? 'Grupos' : f}
              </button>
            ))}
          </div>
        )}

        {/* Status tabs — pill style like image */}
        <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-1.5 mb-5 shadow-sm">
          {tabConfig.map(({ key, label, count }) => {
            const isActive = tab === key
            return (
              <button key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all relative
                  ${isActive ? 'bg-[#0099CC] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                {count > 0 && !isActive && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-[9px] font-bold text-white flex items-center justify-center">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
                {count > 0 && isActive && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-[9px] font-bold text-white flex items-center justify-center">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
                <span className={`text-[13px] font-bold ${isActive ? 'text-white' : ''}`}>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Round nav for upcoming groups */}
        {tab === 'upcoming' && isGroups && upcomingRounds.length > 1 && (
          <div className="flex items-center justify-between mb-4 px-1">
            <button onClick={() => { if(safeRound>0) setRound(r=>r-1) }} disabled={safeRound===0}
              className="flex items-center gap-1 text-[12px] font-semibold text-gray-400 disabled:opacity-30 hover:text-gray-600 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              Anterior
            </button>
            <span className="text-[12px] text-gray-500 font-semibold">
              Rodada {safeRound+1} / {upcomingRounds.length}
            </span>
            <button onClick={() => { if(safeRound<upcomingRounds.length-1) setRound(r=>r+1) }} disabled={safeRound===upcomingRounds.length-1}
              className="flex items-center gap-1 text-[12px] font-semibold text-[#0099CC] disabled:opacity-30 hover:text-[#007aa8] transition-colors">
              Próxima <IconArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Sub-label */}
        <p className="text-[12px] text-gray-400 text-center mb-4">
          {tab === 'upcoming' && 'Próximos jogos para palpitar.'}
          {tab === 'live'     && 'Jogos acontecendo agora.'}
          {tab === 'done'     && 'Resultados e seus palpites.'}
        </p>
      </div>

      {/* Match list */}
      <div className="max-w-lg mx-auto px-4 space-y-3 pb-32">
        {tabMatches.map(m => {
          const pick   = picks[m.id] || { home:'', away:'', saved:false }
          const locked = isLocked(m)
          const homeFlag = getFlag(m.home_team, m.home_flag)
          const awayFlag = getFlag(m.away_team, m.away_flag)
          const factor = m.status === 'done' && m.score_home !== undefined && pick.home !== ''
            ? calcFactor(Number(pick.home), Number(pick.away), m.score_home!, m.score_away!)
            : null

          const dateStr = m.match_date
            ? format(parseISO(m.match_date), "EEE, dd/MM/yy HH:mm", { locale: ptBR }).toUpperCase()
            : ''
          const fase = m.fase === 'Fase de Grupos' ? '1ª FASE' : m.fase.toUpperCase()

          return (
            <div key={m.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">

              {/* Date header */}
              <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 tracking-wide">
                  {dateStr} {dateStr && '·'} {fase}
                </span>
                {m.status === 'live' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> AO VIVO
                  </span>
                )}
                {factor && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${FACTOR_COLOR[factor]}`}>
                    +{FACTOR_PTS[factor]}pts · {factor}
                  </span>
                )}
              </div>

              {/* Match row — flag | input × input | flag */}
              <div className="px-4 py-5 flex items-center gap-3">

                {/* Home flag big */}
                <div className="flex-shrink-0">
                  <span className="text-[52px] leading-none block">{homeFlag}</span>
                </div>

                {/* Center: inputs + team names */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    {locked ? (
                      <>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold border-2
                          ${pick.home !== '' ? 'border-gray-200 bg-gray-50 text-gray-800' : 'border-gray-100 bg-gray-50 text-gray-300'}`}>
                          {pick.home !== '' ? pick.home : '–'}
                        </div>
                        <span className="text-gray-200 text-xl font-light">×</span>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold border-2
                          ${pick.away !== '' ? 'border-gray-200 bg-gray-50 text-gray-800' : 'border-gray-100 bg-gray-50 text-gray-300'}`}>
                          {pick.away !== '' ? pick.away : '–'}
                        </div>
                      </>
                    ) : (
                      <>
                        <input type="number" min="0" max="20" inputMode="numeric"
                          className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-2xl bg-gray-50 text-gray-900
                                     focus:outline-none focus:ring-0 focus:border-[#0099CC] transition-colors"
                          value={pick.home} onChange={e => updatePick(m.id,'home',e.target.value)} placeholder="0" />
                        <span className="text-gray-200 text-xl font-light">×</span>
                        <input type="number" min="0" max="20" inputMode="numeric"
                          className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-2xl bg-gray-50 text-gray-900
                                     focus:outline-none focus:ring-0 focus:border-[#0099CC] transition-colors"
                          value={pick.away} onChange={e => updatePick(m.id,'away',e.target.value)} placeholder="0" />
                      </>
                    )}
                  </div>

                  {/* Team names */}
                  <p className="text-[11px] font-semibold text-gray-400 tracking-wide uppercase text-center">
                    {m.home_team} × {m.away_team}
                  </p>

                  {/* Result if done */}
                  {m.status === 'done' && m.score_home !== undefined && (
                    <p className="text-[11px] text-gray-400">
                      Resultado: <strong className="text-gray-600">{m.score_home} × {m.score_away}</strong>
                    </p>
                  )}
                </div>

                {/* Away flag big */}
                <div className="flex-shrink-0">
                  <span className="text-[52px] leading-none block">{awayFlag}</span>
                </div>
              </div>

              {/* Saved indicator for locked */}
              {locked && pick.home !== '' && (
                <div className="px-4 pb-3 flex items-center justify-center">
                  <span className={`text-[11px] font-semibold flex items-center gap-1 px-3 py-1 rounded-full
                    ${factor ? `${FACTOR_COLOR[factor]}` : 'bg-green-50 text-green-600'}`}>
                    <IconCheck size={11} />
                    {factor ? `Acertou ${factor} (+${FACTOR_PTS[factor]}pts)` : 'Palpite registrado'}
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {tabMatches.length === 0 && (
          <div className="text-center py-14">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <IconBall size={24} className="text-gray-300" />
            </div>
            <p className="text-[13px] text-gray-400">
              {tab === 'live'     && 'Nenhum jogo ao vivo agora.'}
              {tab === 'upcoming' && 'Nenhum jogo disponível para palpitar.'}
              {tab === 'done'     && 'Nenhum jogo encerrado ainda.'}
            </p>
          </div>
        )}
      </div>

      {/* Fixed bottom CTA — only for upcoming */}
      {tab === 'upcoming' && tabMatches.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-20 px-4 pb-2">
          <div className="max-w-lg mx-auto">
            <button onClick={confirmAll} disabled={saving || filledCount === 0}
              className={`w-full py-4 rounded-2xl font-bold text-[15px] tracking-wide transition-all active:scale-[.98] shadow-lg
                flex items-center justify-center gap-2
                ${batchSaved
                  ? 'bg-green-500 text-white'
                  : 'bg-[#0099CC] text-white hover:bg-[#007aa8] disabled:opacity-50 disabled:cursor-not-allowed'}`}>
              {saving
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : batchSaved
                  ? <><IconCheck size={20} /> PALPITES CONFIRMADOS!</>
                  : filledCount > 0
                    ? <>CONFIRMAR PALPITES ({filledCount})</>
                    : 'PREENCHA OS PLACARES'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
