import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Pick, calcFactor, FACTOR_PTS, FACTOR_COLOR, FASE_ORDER, EditLimit } from '@/lib/supabase'
import GroupPicksCard from '@/components/GroupPicksCard'
import Layout from '@/components/Layout'
import FlagImg from '@/components/FlagImg'
import { format, parseISO, subHours, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PickMap  = Record<string, { home: string; away: string; saved: boolean; editCount: number }>
type LimitMap = Record<string, EditLimit>
type GroupConsensus = Record<string, { home: number; away: number; count: number } | null>

const ROUND_SIZE = 8
const MAX_EDITS  = 3
const LOCK_HOURS = 2

const IcoCheck  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoBall   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
const IcoLock   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IcoArrowL = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
const IcoArrowR = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18"/></svg>

// Countdown hook — returns formatted string "Xh Ym" or "Fechado"
function useCountdown(lockAt: Date | null) {
  const [display, setDisplay] = useState('')
  useEffect(() => {
    if (!lockAt) return
    function update() {
      const diff = lockAt!.getTime() - Date.now()
      if (diff <= 0) { setDisplay('Fechado'); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      if (h > 0) setDisplay(`${h}h ${m}m`)
      else if (m > 0) setDisplay(`${m}m ${s}s`)
      else setDisplay(`${s}s`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [lockAt])
  return display
}

// Next lock time — earliest upcoming match lock
function getNextLockDate(matches: Match[]): Date | null {
  const upcoming = matches
    .filter(m => m.status === 'upcoming' && m.match_date)
    .map(m => subHours(parseISO(m.match_date!), LOCK_HOURS))
    .filter(d => d > new Date())
    .sort((a, b) => a.getTime() - b.getTime())
  return upcoming[0] || null
}

// Format UTC date as BRT (UTC-3) using toLocaleString
function fmtBRT(dateStr: string, fmt: string): string {
  const d = parseISO(dateStr)
  // Use Intl to get BRT time regardless of browser/server timezone
  const brtStr = d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: '2-digit',
    weekday: 'short',
  })
  // For simple time format
  if (fmt === 'HH:mm') {
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  }
  // For date format like "Qui., 11/06"
  if (fmt.includes('dd/MM')) {
    const weekday = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' })
    const day     = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit' })
    const month   = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', month: '2-digit' })
    return `${weekday.replace('.','')}.., ${day}/${month}`
  }
  return format(d, fmt, { locale: ptBR })
}

export default function PicksPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [matches,     setMatches]     = useState<Match[]>([])
  const [picks,       setPicks]       = useState<PickMap>({})
  const [limits,      setLimits]      = useState<LimitMap>({})
  const [saving,      setSaving]      = useState(false)
  const [fetching,    setFetching]    = useState(true)
  const [isVisitante, setIsVisitante] = useState(false)
  const [travamentoAtivo, setTravamentoAtivo] = useState(true)
  const travAtivoRef = useRef(true)
  const [activePhase, setActivePhase] = useState('')
  const [tab,         setTab]         = useState<'upcoming'|'live'|'done'|'grupo'>('upcoming')
  const tabManuallySet = useRef(false)
  const setTabManual = (t: typeof tab) => { tabManuallySet.current = true; setTab(t) }
  const [round,       setRound]       = useState(0)
  const [batchSaved,  setBatchSaved]  = useState(false)
  const [consensus,   setConsensus]   = useState<GroupConsensus>({})

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  // Load group consensus (most popular pick per match) — only for locked/done matches
  async function loadConsensus(matchIds: string[]) {
    if (!matchIds.length) return
    const { data } = await supabase
      .from('picks')
      .select('match_id, pick_home, pick_away')
      .in('match_id', matchIds)
    if (!data) return
    const grouped: Record<string, Record<string, number>> = {}
    data.forEach((p: { match_id: string; pick_home: number; pick_away: number }) => {
      const key = `${p.pick_home}-${p.pick_away}`
      if (!grouped[p.match_id]) grouped[p.match_id] = {}
      grouped[p.match_id][key] = (grouped[p.match_id][key] || 0) + 1
    })
    const result: GroupConsensus = {}
    Object.entries(grouped).forEach(([matchId, votes]) => {
      const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
      if (top) {
        const [h, a] = top[0].split('-').map(Number)
        result[matchId] = { home: h, away: a, count: top[1] }
      }
    })
    setConsensus(prev => ({ ...prev, ...result }))
  }

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
    const first  = phases.find(f => ms.some(m => m.fase === f && (m.status === 'upcoming' || m.status === 'live'))) || phases[0]
    setActivePhase(first || '')
    // Dynamic tab: open "live" if any match is live OR in lock window (Em Breve), only on first load
    if (!tabManuallySet.current) {
      const hasLiveOrEmBreve = ms.some(m =>
        m.status === 'live' ||
        (travAtivoRef.current && m.status === 'upcoming' && m.match_date &&
          isBefore(subHours(parseISO(m.match_date), LOCK_HOURS), new Date()))
      )
      setTab(hasLiveOrEmBreve ? 'live' : 'upcoming')
    }
    setFetching(false)
    // Load consensus for all locked/done matches (includes live that are locked)
    const lockedIds = ms.filter(m => {
      if (m.status === 'done') return true
      if (!m.match_date) return false
      return new Date(m.match_date).getTime() - 2 * 3600_000 <= Date.now()
    }).map(m => m.id)
    if (lockedIds.length) loadConsensus(lockedIds)
  }, [player])

  useEffect(() => { fetchData() }, [fetchData])

  // Check visitante mode + travamento de jogos
  useEffect(() => {
    supabase.from('pix_config').select('modo_visitante, lock_jogos').limit(1).then(({ data }) => {
      if (data?.[0]?.modo_visitante && !player?.payment_ok) setIsVisitante(true)
      const trav = data?.[0]?.lock_jogos ?? true
      setTravamentoAtivo(trav)
      travAtivoRef.current = trav
    })
  }, [player?.id])

  function isLocked(m: Match): boolean {
    if (m.status === 'done' || m.status === 'live') return true  // sempre travado após início
    if (!m.match_date) return false
    if (!travamentoAtivo) return false                            // admin desbloqueou temporariamente
    return isBefore(subHours(parseISO(m.match_date), LOCK_HOURS), new Date())
  }

  const phaseMatches    = matches.filter(m => m.fase === activePhase)
  const isGroups        = activePhase === 'Fase de Grupos'
  const upcomingMatches = phaseMatches.filter(m => !isLocked(m))
  // Em Breve: palpites fechados mas jogo ainda não iniciou (dentro da janela de 2h)
  const emBreveMatches  = phaseMatches.filter(m => isLocked(m) && m.status === 'upcoming')
  // Ao Vivo: jogo realmente rolando
  const liveMatches     = phaseMatches.filter(m => m.status === 'live')
  // Tab "Ao vivo" agrupa Em Breve + Ao Vivo (ordenados por horário)
  const liveTabMatches  = [...emBreveMatches, ...liveMatches]
    .sort((a, b) => (a.match_date || '').localeCompare(b.match_date || ''))
  // Encerrados: apenas partidas finalizadas
  const doneMatches     = phaseMatches.filter(m => m.status === 'done')

  const upcomingRounds  = isGroups
    ? Array.from({ length: Math.ceil(upcomingMatches.length / ROUND_SIZE) }, (_, i) =>
        upcomingMatches.slice(i * ROUND_SIZE, (i + 1) * ROUND_SIZE))
    : [upcomingMatches]
  const safeRound    = Math.min(round, Math.max(0, upcomingRounds.length - 1))
  const currentRound = upcomingRounds[safeRound] || []
  const tabMatches   = tab === 'live' ? liveTabMatches : tab === 'done' ? doneMatches : currentRound

  const limitKey    = `${activePhase}:${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' })}`
  const editLimit   = limits[limitKey]
  const editsUsed   = editLimit?.edits_used || 0
  const editsLeft   = MAX_EDITS - editsUsed
  const roundLocked = editsLeft <= 0

  function updatePick(id: string, side: 'home'|'away', val: string) {
    if (roundLocked) return
    setPicks(p => ({ ...p, [id]: { ...p[id], [side]: val.replace(/\D/g,'').slice(0,2), saved: false } }))
  }

  async function confirmAll() {
    if (!player || saving) return
    // Block saving for unpaid users
    if (!player.payment_ok) { router.push('/onboarding'); return }
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
      const ne = editsUsed + 1
      const todayBRT = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' })
      await supabase.from('pick_edit_limits').upsert({
        player_id: player.id, fase: activePhase, round_index: todayBRT, edits_used: ne, max_edits: MAX_EDITS,
      }, { onConflict: 'player_id,fase,round_index' })
      setLimits(l => ({ ...l, [limitKey]: { ...editLimit || { player_id: player.id, fase: activePhase, round_index: todayBRT, max_edits: MAX_EDITS }, edits_used: ne } }))
    }
    setPicks(p => { const n = { ...p }; toSave.forEach(m => { n[m.id] = { ...n[m.id], saved: true } }); return n })

    // Update picks_count in scores table so ranking bar reflects immediately
    // Use update only (not upsert with zeros) to avoid overwriting points
    const { count: totalPicks } = await supabase
      .from('picks').select('*', { count: 'exact', head: true }).eq('player_id', player.id)
    if (totalPicks !== null) {
      // Try update first — only touches picks_count, never overwrites points
      const { error: upErr } = await supabase
        .from('scores')
        .update({ picks_count: totalPicks, updated_at: new Date().toISOString() })
        .eq('player_id', player.id)
      // If row doesn't exist yet, insert with zeros (first time saving picks)
      if (upErr) {
        await supabase.from('scores').insert({
          player_id: player.id, picks_count: totalPicks,
          total_pts: 0, f10_count: 0, f7_count: 0, f5_count: 0, f2_count: 0, f0_count: 0,
          champion_pts: 0, updated_at: new Date().toISOString(),
        })
      }
    }

    setSaving(false); setBatchSaved(true)
  }

  // Group by date (BRT)
  function byDate(ms: Match[]) {
    const g: Record<string, Match[]> = {}
    ms.forEach(m => {
      const k = m.match_date ? fmtBRT(m.match_date, "EEE'., 'dd/MM") : 'Data a definir'
      if (!g[k]) g[k] = []
      g[k].push(m)
    })
    return g
  }

  const phases  = FASE_ORDER.filter(f => matches.some(m => m.fase === f))
  const filled  = tabMatches.filter(m => { const p = picks[m.id]; return p && p.home !== '' && p.away !== '' }).length
  // For done tab, reverse order so newest results appear first
  const sortedTabMatches = tab === 'done' ? [...tabMatches].reverse() : tabMatches
  const grouped = byDate(sortedTabMatches)
  const nextLockDate = getNextLockDate(currentRound)
  const countdown    = useCountdown(nextLockDate)

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
    </div>
  )

  return (
    <Layout title="Palpites">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-2">
        <div className="text-center mb-4">
          <h1 className="text-[18px] font-bold text-gray-900">Palpites</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Bolão Copa 2026 BEL</p>
        </div>

        {/* Visitante banner */}
        {isVisitante && !player?.payment_ok && (
          <div className="mx-4 mt-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-blue-800">Modo visitante</p>
              <p className="text-[11px] text-blue-600 mt-0.5">Acompanhe os jogos e o ranking. Palpites estão desativados neste momento.</p>
            </div>
          </div>
        )}

        {!travamentoAtivo && player?.payment_ok && (
          <div className="mx-4 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-amber-800">Palpites liberados</p>
              <p className="text-[11px] text-amber-700 mt-0.5">O administrador liberou a edição. Jogos não iniciados ainda podem ser alterados.</p>
            </div>
          </div>
        )}

        {/* Phase tabs */}
        {phases.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4" style={{scrollbarWidth:'none'}}>
            {phases.map(f => (
              <button key={f} onClick={() => { setActivePhase(f); setRound(0); setTab('upcoming'); setBatchSaved(false) }}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${activePhase===f?'bg-[#0099CC] text-white':'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                {f === 'Fase de Grupos' ? 'Grupos' : f}
              </button>
            ))}
          </div>
        )}

        {/* Status tabs */}
        <div className="flex bg-white border border-gray-100 rounded-2xl p-1.5 mb-4 shadow-sm">
          {([['live','Ao vivo',liveTabMatches.length],['upcoming','Próximos',upcomingMatches.length],['done','Encerrados',doneMatches.length],['grupo','Grupo',null]] as [typeof tab,string,number|null][]).map(([key,label,count])=>(
            <button key={key} onClick={() => setTabManual(key)}
              className={`flex-1 relative flex items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-bold transition-all ${tab===key?'bg-[#0099CC] text-white shadow-sm':'text-gray-400 hover:text-gray-600'}`}>
              {label}
              {count!=null && count>0 && <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${tab===key?'bg-white/25 text-white':'bg-amber-400 text-white'}`}>{count>9?'9+':count}</span>}
            </button>
          ))}
        </div>

        {/* Round nav — only at bottom (floating) */}

        {/* Warnings */}
        {tab==='upcoming' && roundLocked && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <IcoLock/><span className="text-[12px] text-red-700 font-medium">Limite de alterações atingido para esta rodada.</span>
          </div>
        )}
        {tab==='upcoming' && !roundLocked && editsLeft<=2 && editsUsed>0 && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <IcoLock/><span className="text-[12px] text-amber-700 font-medium">Apenas <strong>{editsLeft}</strong> alteração{editsLeft===1?'':'ões'} restante{editsLeft===1?'':'s'} hoje.</span>
          </div>
        )}

        {/* Payment gate — unpaid users can SEE but not SAVE picks */}
        {!player?.payment_ok && (
          <div className="mb-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-amber-900">Pagamento necessário para palpitar</p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  Você pode explorar os jogos, mas só poderá salvar seus palpites após confirmar o pagamento da inscrição.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/onboarding')}
              className="mt-3 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors active:scale-[.98]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              Pagar R${(10).toFixed(2).replace('.',',')} e liberar palpites
            </button>
          </div>
        )}

        {/* Countdown to next lock */}
        {tab === 'upcoming' && countdown && countdown !== 'Fechado' && (
          <div className="mb-2 mx-auto max-w-lg px-4">
            <div className="bg-[#E6F4FA] border border-[#0099CC]/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-[12px] text-[#0099CC] font-medium">Palpites fecham em</span>
              </div>
              <span className="text-[14px] font-bold text-[#0099CC] tabular-nums">{countdown}</span>
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center mb-2">
          {tab==='upcoming' ? `Palpites fecham ${LOCK_HOURS}h antes de cada jogo · horário de Brasília` : tab==='live' ? 'Jogos em breve e ao vivo' : tab==='grupo' ? 'O que o grupo apostou' : 'Resultados'}
        </p>
      </div>

      {/* ── Match list ──────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 pb-36 space-y-3">

        {/* ── GRUPO TAB ── */}
        {tab === 'grupo' && (() => {
          const lockedMatches = matches.filter(m => isLocked(m) || m.status === 'live' || m.status === 'done').reverse()
          return lockedMatches.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-gray-600 mb-1">Ainda não há jogos travados</p>
              <p className="text-[11px] text-gray-400">Os palpites do grupo aparecem aqui após o fechamento, 2h antes de cada jogo.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[11px] text-gray-400 text-center">Palpites revelados após fechamento · {lockedMatches.length} jogo{lockedMatches.length !== 1 ? 's' : ''}</p>
              {lockedMatches.map(m => <GroupPicksCard key={m.id} match={m}/>)}
            </div>
          )
        })()}

        {tab !== 'grupo' && Object.entries(grouped).map(([dateLabel, dayMatches]) => (
          <div key={dateLabel}>
            {/* Date header */}
            <div className="bg-gray-100 border-y border-gray-200 px-4 py-2 -mx-4 mb-2">
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                {activePhase === 'Fase de Grupos' ? 'Fase de grupos' : activePhase} · {dateLabel.toUpperCase()}
              </span>
            </div>

            {/* 2-column grid */}
            <div className="grid grid-cols-1 gap-3">
              {dayMatches.map(m => {
                const pick   = picks[m.id] || { home:'', away:'', saved:false, editCount:0 }
                const locked = !player?.payment_ok || isLocked(m) || (isVisitante && !player?.payment_ok) || (tab==='upcoming' && roundLocked && pick.saved)
                const factor = m.status==='done' && m.score_home!==undefined && pick.home!==''
                  ? calcFactor(Number(pick.home), Number(pick.away), m.score_home!, m.score_away!) : null
                const timeBRT = m.match_date ? fmtBRT(m.match_date, 'HH:mm') : ''

                return (
                  <div key={m.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    {/* Card header */}
                    <div className={`px-3 py-1.5 flex items-center justify-between border-b ${m.status==='live'?'bg-red-50 border-red-100':m.status==='done'?'bg-gray-50 border-gray-100':(m.status==='upcoming'&&isLocked(m))?'bg-amber-50/70 border-amber-100':'bg-blue-50/40 border-blue-100/40'}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {m.status==='live' && <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full whitespace-nowrap"><span className="relative flex h-2 w-2 flex-shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"/></span>AO VIVO</span>}
                        {m.status==='done' && <span className="text-[10px] font-medium text-gray-500">Encerrado</span>}
                        {m.status==='upcoming' && isLocked(m) && (
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <span className="relative flex h-2 w-2 flex-shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"/></span>
                            EM BREVE · {timeBRT}
                          </span>
                        )}
                        {m.status==='upcoming' && !isLocked(m) && <span className="text-[10px] font-bold text-[#0099CC] whitespace-nowrap">{timeBRT}</span>}
                        {m.group_name && <span className="text-[10px] text-gray-400 truncate">· {m.group_name}</span>}
                      </div>
                      <div className="flex-shrink-0 ml-1">
                        {m.status === 'live' && pick.home !== '' && m.score_home != null && m.score_away != null && (() => {
                          const liveF = calcFactor(Number(pick.home), Number(pick.away), m.score_home!, m.score_away!)
                          const liveColors: Record<string,{bg:string;text:string;pts:string}> = {
                            F10:{bg:'#DCFCE7',text:'#15803D',pts:'+10 pts'},
                            F7: {bg:'#DCFCE7',text:'#15803D',pts:'+7 pts'},
                            F5: {bg:'#DBEAFE',text:'#1D4ED8',pts:'+5 pts'},
                            F2: {bg:'#FEF9C3',text:'#854D0E',pts:'+2 pts'},
                            F0: {bg:'#FEE2E2',text:'#DC2626',pts:'0 pts'},
                          }
                          const lc = liveColors[liveF]
                          return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{background:lc.bg,color:lc.text}}>{lc.pts} agora</span>
                        })()}
                        {m.status !== 'live' && factor && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${FACTOR_COLOR[factor]}`}>+{FACTOR_PTS[factor]}pts</span>}
                        {!locked && pick.saved && !factor && m.status !== 'live' && <span className="flex items-center gap-0.5 text-[10px] text-green-600 font-semibold whitespace-nowrap"><IcoCheck/>Salvo</span>}
                      </div>
                    </div>

                    {/* Match body: flag | name | input × input | name | flag */}
                    <div className="px-2 py-3">
                      {/* Teams row */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        {/* Home */}
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <FlagImg team={m.home_team} dbFlag={m.home_flag} size={44}/>
                          <span className="text-[10px] font-bold text-gray-700 text-center leading-tight uppercase w-full truncate px-1">
                            {m.home_team.length > 8 ? m.home_team.slice(0,8)+'.' : m.home_team}
                          </span>
                        </div>

                        {/* Score inputs */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {m.status === 'live' ? (() => {
                            const liveColors = {
                              F10:{ bg:'#DCFCE7', border:'#86EFAC', text:'#15803D', icon:'#16A34A', label:'Acertou tudo!',      pts:'+10 pts' },
                              F7: { bg:'#DCFCE7', border:'#86EFAC', text:'#15803D', icon:'#16A34A', label:'Vencedor + 1 gol',    pts:'+7 pts'  },
                              F5: { bg:'#DBEAFE', border:'#93C5FD', text:'#1D4ED8', icon:'#2563EB', label:'Acertou o vencedor',  pts:'+5 pts'  },
                              F2: { bg:'#FEF9C3', border:'#FDE047', text:'#854D0E', icon:'#B45309', label:'Acertou 1 gol',       pts:'+2 pts'  },
                              F0: { bg:'#FEE2E2', border:'#FCA5A5', text:'#DC2626', icon:'#DC2626', label:'Nenhum acerto',       pts:'0 pts'   },
                            }
                            const liveF = m.score_home != null && m.score_away != null && pick.home !== ''
                              ? calcFactor(Number(pick.home), Number(pick.away), m.score_home, m.score_away)
                              : null
                            const lc = liveF ? liveColors[liveF] : null
                            const iconChar = liveF === 'F10' || liveF === 'F7' ? '✓' : liveF === 'F5' ? '↗' : liveF === 'F2' ? '=' : '✕'
                            return (
                              /* LIVE: same layout as done — official score center, my pick bottom-left, verdict bottom-right */
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold border ${m.score_home != null ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-300'}`}>
                                    {m.score_home != null ? m.score_home : '–'}
                                  </div>
                                  <span className="text-gray-300 text-sm">×</span>
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold border ${m.score_away != null ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-300'}`}>
                                    {m.score_away != null ? m.score_away : '–'}
                                  </div>
                                </div>
                                <span className="text-[8px] text-red-400">
                                  {m.score_home == null ? 'Aguardando...' : 'Placar ao vivo'}
                                </span>
                              </div>
                            )
                          })() : locked ? (
                            /* Locked or done — show pick or official score */
                            <>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold border ${
                                m.status === 'done' && m.score_home != null
                                  ? 'border-gray-200 bg-gray-100 text-gray-800'
                                  : pick.home !== '' ? 'border-gray-200 bg-gray-50 text-gray-800' : 'border-gray-100 bg-gray-50 text-gray-300'
                              }`}>
                                {m.status === 'done' && m.score_home != null ? m.score_home : pick.home !== '' ? pick.home : '–'}
                              </div>
                              <span className="text-gray-300 text-sm">×</span>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold border ${
                                m.status === 'done' && m.score_away != null
                                  ? 'border-gray-200 bg-gray-100 text-gray-800'
                                  : pick.away !== '' ? 'border-gray-200 bg-gray-50 text-gray-800' : 'border-gray-100 bg-gray-50 text-gray-300'
                              }`}>
                                {m.status === 'done' && m.score_away != null ? m.score_away : pick.away !== '' ? pick.away : '–'}
                              </div>
                            </>
                          ) : (
                            <>
                              <input type="number" min="0" max="20" inputMode="numeric"
                                className={`w-10 h-10 text-center text-lg font-bold border-2 rounded-xl bg-white text-gray-900 focus:outline-none transition-colors appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${pick.home !== '' ? 'border-green-400 bg-green-50 text-green-700' : 'border-[#0099CC]/40 focus:border-[#0099CC]'}`}
                                value={pick.home} onChange={e=>updatePick(m.id,'home',e.target.value)} placeholder=""/>
                              <span className="text-gray-200 text-sm">×</span>
                              <input type="number" min="0" max="20" inputMode="numeric"
                                className={`w-10 h-10 text-center text-lg font-bold border-2 rounded-xl bg-white text-gray-900 focus:outline-none transition-colors appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${pick.away !== '' ? 'border-green-400 bg-green-50 text-green-700' : 'border-[#0099CC]/40 focus:border-[#0099CC]'}`}
                                value={pick.away} onChange={e=>updatePick(m.id,'away',e.target.value)} placeholder=""/>
                            </>
                          )}
                        </div>

                        {/* Away */}
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <FlagImg team={m.away_team} dbFlag={m.away_flag} size={44}/>
                          <span className="text-[10px] font-bold text-gray-700 text-center leading-tight uppercase w-full truncate px-1">
                            {m.away_team.length > 8 ? m.away_team.slice(0,8)+'.' : m.away_team}
                          </span>
                        </div>
                      </div>

                      {/* Live match — pick row below score */}
                      {m.status === 'live' && pick.home !== '' && (() => {
                        const liveColors = {
                          F10:{bg:'#DCFCE7',border:'#86EFAC',text:'#15803D',icon:'#16A34A',label:'Acertou tudo!',     pts:'+10 pts'},
                          F7: {bg:'#DCFCE7',border:'#86EFAC',text:'#15803D',icon:'#16A34A',label:'Vencedor + 1 gol',   pts:'+7 pts'},
                          F5: {bg:'#DBEAFE',border:'#93C5FD',text:'#1D4ED8',icon:'#2563EB',label:'Acertou o vencedor', pts:'+5 pts'},
                          F2: {bg:'#FEF9C3',border:'#FDE047',text:'#854D0E',icon:'#B45309',label:'Acertou 1 gol',      pts:'+2 pts'},
                          F0: {bg:'#FEE2E2',border:'#FCA5A5',text:'#DC2626',icon:'#DC2626',label:'Nenhum acerto',      pts:'0 pts'},
                        }
                        const liveF = m.score_home != null && m.score_away != null
                          ? calcFactor(Number(pick.home), Number(pick.away), m.score_home, m.score_away) : null
                        const lc = liveF ? liveColors[liveF] : null
                        const iconChar = liveF === 'F10' || liveF === 'F7' ? '✓' : liveF === 'F5' ? '↗' : liveF === 'F2' ? '=' : '✕'
                        return (
                          <div className="flex items-center justify-between px-1 mt-2 pt-2 border-t border-gray-100">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] text-gray-400">Meu palpite</span>
                              <div className="flex items-center gap-1">
                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[12px] font-bold border"
                                  style={lc ? {background:lc.bg,borderColor:lc.border,color:lc.text} : {background:'#f9fafb',borderColor:'#e5e7eb',color:'#374151'}}>
                                  {pick.home}
                                </div>
                                <span className="text-[10px] text-gray-300">×</span>
                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[12px] font-bold border"
                                  style={lc ? {background:lc.bg,borderColor:lc.border,color:lc.text} : {background:'#f9fafb',borderColor:'#e5e7eb',color:'#374151'}}>
                                  {pick.away}
                                </div>
                              </div>
                            </div>
                            {lc && (
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1">
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                    style={{background:lc.icon}}>{iconChar}</div>
                                  <span className="text-[10px] font-semibold" style={{color:lc.text}}>{lc.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{background:lc.bg,color:lc.text}}>
                                  {lc.pts} se ficar assim
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Done match — rich result card */}
                      {m.status==='done' && m.score_home!=null && (() => {
                        const f = factor
                        const hasPick = pick.home !== ''
                        const colors = {
                          f10: { bg:'#DCFCE7', border:'#86EFAC', text:'#15803D', icon:'#16A34A', label:'Acertou tudo!',      pts:'+10 pts' },
                          f7:  { bg:'#DCFCE7', border:'#86EFAC', text:'#15803D', icon:'#16A34A', label:'Vencedor + 1 gol',    pts:'+7 pts'  },
                          f5:  { bg:'#DBEAFE', border:'#93C5FD', text:'#1D4ED8', icon:'#2563EB', label:'Acertou o vencedor',  pts:'+5 pts'  },
                          f2:  { bg:'#FEF9C3', border:'#FDE047', text:'#854D0E', icon:'#B45309', label:'Acertou 1 gol',       pts:'+2 pts'  },
                          f0:  { bg:'#FEE2E2', border:'#FCA5A5', text:'#DC2626', icon:'#DC2626', label:'Nenhum acerto',       pts:'0 pts'   },
                        }
                        const fKey = f ? f.toLowerCase() as keyof typeof colors : 'f0'
                        const c = hasPick && f ? colors[fKey] || colors.f0 : null
                        const iconChar = fKey === 'f10' || fKey === 'f7' ? '✓' : fKey === 'f5' ? '↗' : fKey === 'f2' ? '=' : '✕'
                        return (
                          <div className="mt-2 space-y-2">
                            {hasPick && c && (
                              <div className="flex items-center justify-between px-1">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] text-gray-400 font-medium">Meu palpite</span>
                                  <div className="flex items-center gap-1">
                                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[13px] font-bold border"
                                      style={{background:c.bg,borderColor:c.border,color:c.text}}>{pick.home}</div>
                                    <span className="text-[10px] text-gray-300">×</span>
                                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[13px] font-bold border"
                                      style={{background:c.bg,borderColor:c.border,color:c.text}}>{pick.away}</div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                      style={{background:c.icon}}>{iconChar}</div>
                                    <span className="text-[11px] font-semibold" style={{color:c.text}}>{c.label}</span>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{background:c.bg,color:c.text}}>{c.pts}</span>
                                </div>
                              </div>
                            )}
                            <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-0.5">
                              <p className="text-[10px] text-gray-600">
                                Resultado oficial: <strong className="text-gray-900">{m.home_team} {m.score_home}×{m.score_away} {m.away_team}</strong>
                              </p>
                              {m.status === 'done' && consensus[m.id] && (() => {
                                const c = consensus[m.id]!
                                const isExact = m.score_home === c.home && m.score_away === c.away
                                return (
                                  <p className="text-[10px] text-gray-600">
                                    {isExact
                                      ? <><strong className="text-gray-900">{c.count} {c.count === 1 ? 'pessoa' : 'pessoas'}</strong> do grupo {c.count === 1 ? 'cravou' : 'cravaram'} o placar exato <strong className="text-gray-900">{c.home}×{c.away}</strong>!</>
                                      : <>O palpite mais popular foi <strong className="text-gray-900">{c.home}×{c.away}</strong> por <strong className="text-gray-900">{c.count} {c.count === 1 ? 'pessoa' : 'pessoas'}</strong>.</>
                                    }
                                  </p>
                                )
                              })()}
                            </div>
                          </div>
                        )
                      })()}
                      {/* Locked no pick */}
                      {locked && pick.home==='' && m.status==='upcoming' && (
                        <div className="flex justify-center">
                          <span className="text-[9px] text-amber-600 flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <IcoLock/> Fechado
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {tab !== 'grupo' && Object.keys(grouped).length === 0 && (
          <div className="text-center py-14">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-300"><IcoBall/></div>
            <p className="text-[13px] text-gray-400">
              {tab==='live'?'Nenhum jogo ao vivo ou em breve.':tab==='upcoming'?'Nenhum jogo disponível.':'Nenhum jogo encerrado.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Fixed CTA ───────────────────────────────────────────────── */}
      {tab==='upcoming' && currentRound.length>0 && !roundLocked && (
        <div className="fixed left-0 right-0 z-20 px-4"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 56px)',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            paddingBottom: '8px',
          }}>
          <div className="max-w-lg mx-auto space-y-2">
            {/* Edit limit indicator */}
            {batchSaved && player?.payment_ok && (
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <IcoLock/>
                  <div>
                    <p className="text-[12px] font-bold text-gray-700">
                      {editsLeft>0 ? `${editsLeft} alteração${editsLeft===1?'':'ões'} disponível${editsLeft===1?'':'is'}` : 'Limite atingido'}
                    </p>
                    <p className="text-[11px] text-gray-400">Máx. {MAX_EDITS} alterações por dia</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({length:MAX_EDITS}).map((_,i)=>(
                    <div key={i} className={`w-2.5 h-2.5 rounded-full ${i<editsUsed?'bg-amber-400':'bg-gray-200'}`}/>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom round nav — mirrors top nav */}
            {isGroups && upcomingRounds.length>1 && (
              <div className="bg-white/95 backdrop-blur border border-gray-100 rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-sm">
                <button onClick={() => { if(safeRound>0){setRound(r=>r-1);setBatchSaved(false)} }} disabled={safeRound===0}
                  className="flex items-center gap-1 text-[12px] font-semibold text-gray-400 disabled:opacity-30 hover:text-gray-600">
                  <IcoArrowL/> Anterior
                </button>
                <span className="text-[12px] text-gray-600 font-bold">
                  Rodada {safeRound+1} / {upcomingRounds.length}
                </span>
                <button onClick={() => { if(safeRound<upcomingRounds.length-1){setRound(r=>r+1);setBatchSaved(false)} }} disabled={safeRound===upcomingRounds.length-1}
                  className="flex items-center gap-1 text-[12px] font-semibold text-[#0099CC] disabled:opacity-30 hover:text-[#007aa8]">
                  Próxima <IcoArrowR/>
                </button>
              </div>
            )}

            {/* Unpaid users: lock button */}
            {!player?.payment_ok && isVisitante ? (
              <div className="w-full py-3.5 rounded-2xl bg-blue-100 text-blue-600 font-semibold text-[14px] flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Modo visitante — só visualização
              </div>
            ) : !player?.payment_ok ? (
              <button onClick={() => router.push('/onboarding')}
                className="w-full py-4 rounded-2xl font-bold text-[15px] tracking-wide shadow-lg flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white transition-all active:scale-[.98]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                PAGAR INSCRIÇÃO PARA PALPITAR
              </button>
            ) : (
              <button onClick={batchSaved?()=>{}:confirmAll} disabled={saving||(!batchSaved&&filled===0)}
                className={`w-full py-4 rounded-2xl font-bold text-[15px] tracking-wide transition-all shadow-lg flex items-center justify-center gap-2
                  ${batchSaved?'bg-gray-200 text-gray-500 cursor-default'
                    :saving?'bg-[#0099CC] text-white'
                    :filled>0?'bg-[#0099CC] text-white hover:bg-[#007aa8] active:scale-[.98]'
                    :'bg-[#0099CC]/40 text-white/60 cursor-not-allowed'}`}>
                {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                 : batchSaved ? <><IcoCheck/> PALPITES CONFIRMADOS · <span className="bg-gray-400 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{editsLeft}/{MAX_EDITS}</span></>
                 : filled>0 ? `CONFIRMAR PALPITES (${filled})` : 'PREENCHA OS PLACARES'}
              </button>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
