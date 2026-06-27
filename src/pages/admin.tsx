import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Player, FASE_ORDER, getPresence, formatOnlineTime } from '@/lib/supabase'
import Head from 'next/head'
import { formatPixKeyDisplay, getKeyTypeLabel, PixKeyType } from '@/lib/pix'
import FlagImg from '@/components/FlagImg'
import GroupLabelEditor from '@/components/GroupLabelEditor'

type Page = 'dashboard' | 'players' | 'matches' | 'pix' | 'logs' | 'notifications' | 'versao'
type SyncResult = { ok: boolean; synced: number; updated: number; recalculated: boolean; quotaRemaining: number | null; goalsNotified?: number; goalEvents?: unknown[]; error?: string }

function fmtBRT(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

function fmtTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

// SVG icons
const Ico = {
  Dashboard:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Users:         () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Ball:          () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/><path d="M2 12h20"/></svg>,
  Pix:           () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  Logs:          () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Bell:          () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Sync:          () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Check:         () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Trophy:        () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>,
  Trash:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Logout:        () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Eye:           () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Star:          () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
}

export default function AdminPage() {
  const { player, loading, isAdmin, logout } = useAuth()
  const router = useRouter()
  const [page,          setPage]          = useState<Page>('dashboard')
  const [versaoCopied,  setVersaoCopied]  = useState(false)
  const [matches,       setMatches]       = useState<Match[]>([])
  const matchesRef = useRef<Match[]>([])
  useEffect(() => { matchesRef.current = matches }, [matches])
  const [players,       setPlayers]       = useState<Player[]>([])
  const [fetching,      setFetching]      = useState(true)
  const [activePhase,   setActivePhase]   = useState('Fase de Grupos')
  const [matchView,     setMatchView]     = useState<'jogos'|'historico'>('jogos')
  const [syncing,       setSyncing]       = useState(false)
  const [syncResult,    setSyncResult]    = useState<SyncResult | null>(null)
  const [recalcing,     setRecalcing]     = useState(false)
  const [backfilling,   setBackfilling]   = useState(false)
  const [backfillMsg,   setBackfillMsg]   = useState<string | null>(null)
  const [recalcMsg,     setRecalcMsg]     = useState('')
  const [editId,        setEditId]        = useState<string | null>(null)
  const [resH,          setResH]          = useState('')
  const [resA,          setResA]          = useState('')
  const [saving,        setSaving]        = useState(false)
  const [streamEditId,  setStreamEditId]  = useState<string | null>(null)
  const [streamUrl,     setStreamUrl]     = useState('')
  const [savingStream,  setSavingStream]  = useState(false)
  // Correção manual de palpite (admin corrige o palpite de 1 jogador em 1 jogo,
  // mesmo já travado/ao vivo/encerrado — usado para corrigir bugs de salvamento)
  const [fixPickMatchId, setFixPickMatchId] = useState<string | null>(null)
  const [fixPlayerQuery, setFixPlayerQuery] = useState('')
  const [fixPlayerId,    setFixPlayerId]    = useState<string | null>(null)
  const [fixHome,        setFixHome]        = useState('')
  const [fixAway,        setFixAway]        = useState('')
  const [fixSaving,      setFixSaving]      = useState(false)
  const [fixMsg,         setFixMsg]         = useState<{ type: 'ok'|'error'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [championStats, setChampionStats] = useState<{ team: string; count: number; flag?: string }[]>([])
  const [totalChampPicks, setTotalChampPicks] = useState(0)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderResult, setReminderResult] = useState('')
  const [togglingId,    setTogglingId]    = useState<string | null>(null)
  const [lastAutoSync,  setLastAutoSync]  = useState<string>('')
  const [autoSyncing,   setAutoSyncing]   = useState(false)
  const [quotaRemaining,setQuotaRemaining]= useState<number|null>(null)
  const [dbLastSync,    setDbLastSync]    = useState<{ at: string | null; ok: boolean | null }>({ at: null, ok: null })
  const [syncCheckLoaded, setSyncCheckLoaded] = useState(false)
  const [lastSyncTime,  setLastSyncTime]  = useState<string>('')
  const [pixCpf,        setPixCpf]        = useState('')
  const [pixKeyType,    setPixKeyType]    = useState<PixKeyType>('cpf')
  const [pixNome,       setPixNome]       = useState('')
  const [pixValor,      setPixValor]      = useState('10')
  const [pixDesc,       setPixDesc]       = useState('Bolão Copa 2026 BEL')
  const [pixWhatsApp,   setPixWhatsApp]   = useState('')
  const [pixGroupLink,  setPixGroupLink]  = useState('')
  const [savingPix,     setSavingPix]     = useState(false)
  const [pixSaved,      setPixSaved]      = useState(false)
  const [extraAmount,   setExtraAmount]   = useState('')
  const [extraNote,     setExtraNote]     = useState('')
  const [savingExtra,   setSavingExtra]   = useState(false)
  const [extraSaved,    setExtraSaved]    = useState(false)
  const [currentExtra,  setCurrentExtra]  = useState(0)
  const [playerSearch,  setPlayerSearch]  = useState('')
  const [playerPage,    setPlayerPage]    = useState(0)
  const [playerFilter,  setPlayerFilter]  = useState<'all'|'paid'|'pending'|'nopicks'>('all')
  const [picksCount,    setPicksCount]    = useState<Record<string, number>>({})
  const [pushEnabled,   setPushEnabled]   = useState<Set<string>>(new Set())
  const [resettingChampId,  setResettingChampId]  = useState<string | null>(null)
  const [resettingChampAll, setResettingChampAll] = useState(false)
  const [resetMsg,          setResetMsg]          = useState('')
  const [resetPassPlayer,   setResetPassPlayer]   = useState<Player | null>(null)
  const [newPassword,       setNewPassword]       = useState('')
  const [savingPass,        setSavingPass]        = useState(false)
  const [passMsg,           setPassMsg]           = useState('')
  const [presenceTick,  setPresenceTick]  = useState(0)
  const [paymentLogs,   setPaymentLogs]   = useState<{id:string;player_name:string;action:string;confirmed_by:string;valor:number;created_at:string}[]>([])
  const [calcingBadges, setCalcingBadges] = useState(false)
  const [badgesMsg,     setBadgesMsg]     = useState('')
  const [pushTitle,     setPushTitle]     = useState('')
  const [pushBody,      setPushBody]      = useState('')
  const [pushSending,   setPushSending]   = useState(false)
  const [pushMsg,       setPushMsg]       = useState('')
  const [refreshing,    setRefreshing]    = useState(false)
  const [autoNotify,    setAutoNotify]    = useState(true)
  const [lastAutoNotify,setLastAutoNotify]= useState('')
  const [autoNotifyLog, setAutoNotifyLog] = useState<string[]>([])
  // Live dashboard features
  const [liveScores,    setLiveScores]    = useState<Record<string, {h:number;a:number}>>({})
  const [liveLastTick,  setLiveLastTick]  = useState<string>('')
  const [upcomingAlerts,setUpcomingAlerts]= useState<{match:Match;unpicked:number}[]>([])
  const [rankingTop5,   setRankingTop5]   = useState<{player_id:string;name:string;pts:number;avatar?:string;prev_pos?:number}[]>([])
  const [copaBloqueada,  setCopaBloqueada]  = useState(false)
  const [champBloqueado, setChampBloqueado] = useState(false)
  const [modoVisitante,  setModoVisitante]  = useState(false)
  const [travamentoJogos,setTravamentoJogos]= useState(true)
  const [watchAtivo,     setWatchAtivo]     = useState(false)
  const [savingLock,     setSavingLock]     = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!player) { router.push('/'); return }
      if (!isAdmin) { router.push('/ranking'); return }
    }
  }, [loading, player, isAdmin])

  const fetchAll = useCallback(async () => {
    const [{ data: mData }, { data: pData }] = await Promise.all([
      supabase.from('matches').select('*').order('sort_order'),
      supabase.from('players').select('*').order('created_at'),
    ])
    setMatches((mData || []) as Match[])
    setPlayers((pData || []) as Player[])
    const { data: pixRows } = await supabase.from('pix_config').select('*').limit(1)
    if (pixRows?.[0]) {
      setPixCpf(pixRows[0].cpf || '')
      setPixKeyType((pixRows[0].key_type as PixKeyType) || 'cpf')
      setPixNome(pixRows[0].nome || '')
      setPixValor(String(pixRows[0].valor || 10))
      setPixDesc(pixRows[0].descrição || 'Bolão Copa 2026 BEL')
      setPixWhatsApp(pixRows[0].whatsapp || '')
      setPixGroupLink(pixRows[0].group_link || '')
    }
    const { data: prizeRows } = await supabase.from('prize_config').select('extra_amount').limit(1)
    if (prizeRows?.[0]) setCurrentExtra(Number(prizeRows[0].extra_amount) || 0)
    const { data: scoresData } = await supabase.from('scores').select('player_id, picks_count')
    if (scoresData) {
      const map: Record<string, number> = {}
      scoresData.forEach((s: { player_id: string; picks_count: number }) => { map[s.player_id] = s.picks_count || 0 })
      setPicksCount(map)
    }
    // Aggregate champion picks (most-bet champion)
    const { data: champData } = await supabase.from('champion_picks').select('pick_champion')
    if (champData) {
      const counts: Record<string, number> = {}
      champData.forEach((c: { pick_champion: string | null }) => {
        if (c.pick_champion) counts[c.pick_champion] = (counts[c.pick_champion] || 0) + 1
      })
      const sorted = Object.entries(counts)
        .map(([team, count]) => ({ team, count }))
        .sort((a, b) => b.count - a.count)
      setChampionStats(sorted)
      setTotalChampPicks(champData.filter((c: { pick_champion: string | null }) => c.pick_champion).length)
    }
    // Load push subscriptions via API (bypasses RLS)
    const pushRes = await fetch('/api/admin/push-status')
    if (pushRes.ok) {
      const { playerIds } = await pushRes.json()
      setPushEnabled(new Set(playerIds || []))
    }
    setFetching(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Busca do banco quando foi o último sync que de fato rodou — diferente de
  // lastSyncTime (que só existe se ESTE navegador disparou o sync agora),
  // este valor é gravado pela própria rota /api/sync a cada execução, então
  // reflete a realidade mesmo que o painel tenha ficado fechado por horas.
  const checkDbSync = useCallback(async () => {
    const { data } = await supabase.from('pix_config').select('last_sync_at, last_sync_ok').limit(1)
    if (data?.[0]) setDbLastSync({ at: data[0].last_sync_at, ok: data[0].last_sync_ok })
    setSyncCheckLoaded(true)
  }, [])

  useEffect(() => {
    checkDbSync()
    const interval = setInterval(checkDbSync, 60_000)
    return () => clearInterval(interval)
  }, [checkDbSync])

  // Presence refresh every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase.from('players').select('id, last_seen_at')
      if (data) {
        setPlayers(prev => prev.map(p => {
          const fresh = data.find((d: { id: string; last_seen_at: string }) => d.id === p.id)
          return fresh ? { ...p, last_seen_at: fresh.last_seen_at } : p
        }))
        setPresenceTick(t => t + 1)
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Live scores polling — every 30s when there are live matches
  useEffect(() => {
    async function pollLive() {
      const live = matches.filter(m => m.status === 'live')
      if (live.length === 0) return
      const { data } = await supabase
        .from('matches')
        .select('id, score_home, score_away, status')
        .in('id', live.map(m => m.id))
      if (data) {
        const map: Record<string, {h:number;a:number}> = {}
        data.forEach((m: {id:string;score_home:number;score_away:number}) => {
          if (m.score_home != null) map[m.id] = { h: m.score_home, a: m.score_away }
        })
        setLiveScores(map)
        setLiveLastTick(new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }))
        // Update matches state with fresh scores
        setMatches(prev => prev.map(m => {
          const fresh = data.find((d: {id:string}) => d.id === m.id)
          return fresh ? { ...m, score_home: fresh.score_home, score_away: fresh.score_away, status: fresh.status } : m
        }))
      }
    }
    pollLive()
    const interval = setInterval(pollLive, 30_000)
    return () => clearInterval(interval)
  }, [matches.filter(m => m.status === 'live').length])

  // Upcoming alerts — games in next 2h with unpicked players
  useEffect(() => {
    if (!player) return
    async function checkAlerts() {
      const now   = new Date()
      const in2h  = new Date(now.getTime() + 2 * 3600_000)
      const soon  = matches.filter(m =>
        m.status === 'upcoming' && m.match_date &&
        new Date(m.match_date) > now &&
        new Date(m.match_date) <= in2h
      )
      if (soon.length === 0) { setUpcomingAlerts([]); return }
      const alerts: {match:Match;unpicked:number}[] = []
      const paidIds = players.filter(p => p.payment_ok && !p.is_admin).map(p => p.id)
      for (const m of soon) {
        const { count } = await supabase
          .from('picks')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', m.id)
        const picked   = count || 0
        const unpicked = Math.max(0, paidIds.length - picked)
        alerts.push({ match: m, unpicked })
      }
      setUpcomingAlerts(alerts.filter(a => a.unpicked > 0))
    }
    checkAlerts()
    const interval = setInterval(checkAlerts, 60_000)
    return () => clearInterval(interval)
  }, [matches, players])

  // Top 5 ranking live
  useEffect(() => {
    if (!player) return
    async function loadRanking() {
      const [{ data: scores }, { data: pls }] = await Promise.all([
        supabase.from('scores').select('player_id, total_pts').order('total_pts', { ascending: false }).limit(5),
        supabase.from('players').select('id, nickname, username, avatar_url').eq('is_admin', false),
      ])
      if (!scores || !pls) return
      const top = scores.map((s: {player_id:string;total_pts:number}) => {
        const p = pls.find((pl: {id:string}) => pl.id === s.player_id)
        return {
          player_id: s.player_id,
          name: (p as {nickname?:string;username?:string})?.nickname || (p as {username?:string})?.username || '?',
          pts: s.total_pts,
          avatar: (p as {avatar_url?:string})?.avatar_url,
        }
      })
      setRankingTop5(top)
    }
    loadRanking()
    // No polling — ranking only updates when admin recalculates
    // This prevents position flickering when players have equal pts
  }, [player?.id])

  // Load copa lock state
  useEffect(() => {
    supabase.from('pix_config').select('copa_bloqueada, champ_bloqueado, modo_visitante, lock_jogos, watch_ativo').limit(1).then(({ data }) => {
      if (data?.[0]) {
        setCopaBloqueada(data[0].copa_bloqueada || false)
        setChampBloqueado(data[0].champ_bloqueado || false)
        setModoVisitante(data[0].modo_visitante || false)
        setTravamentoJogos(data[0].lock_jogos ?? true)
        setWatchAtivo(data[0].watch_ativo || false)
      }
    })
  }, [])

  async function toggleCopaLock() {
    setSavingLock(true)
    const newVal = !copaBloqueada
    const { data: rows } = await supabase.from('pix_config').select('id').limit(1)
    if (rows?.[0]) await supabase.from('pix_config').update({ copa_bloqueada: newVal }).eq('id', rows[0].id)
    setCopaBloqueada(newVal)
    setSavingLock(false)
  }

  async function toggleModoVisitante() {
    setSavingLock(true)
    const newVal = !modoVisitante
    const { data: rows } = await supabase.from('pix_config').select('id').limit(1)
    if (rows?.[0]) await supabase.from('pix_config').update({ modo_visitante: newVal }).eq('id', rows[0].id)
    setModoVisitante(newVal)
    setSavingLock(false)
  }

  async function toggleChampLock() {
    setSavingLock(true)
    const newVal = !champBloqueado
    const { data: rows } = await supabase.from('pix_config').select('id').limit(1)
    if (rows?.[0]) await supabase.from('pix_config').update({ champ_bloqueado: newVal }).eq('id', rows[0].id)
    setChampBloqueado(newVal)
    setSavingLock(false)
  }

  async function toggleTravamentoJogos() {
    setSavingLock(true)
    const newVal = !travamentoJogos
    const { data: rows } = await supabase.from('pix_config').select('id').limit(1)
    if (rows?.[0]) await supabase.from('pix_config').update({ lock_jogos: newVal }).eq('id', rows[0].id)
    setTravamentoJogos(newVal)
    setSavingLock(false)
  }

  async function toggleWatchAtivo() {
    setSavingLock(true)
    const newVal = !watchAtivo
    const { data: rows } = await supabase.from('pix_config').select('id').limit(1)
    if (rows?.[0]) await supabase.from('pix_config').update({ watch_ativo: newVal }).eq('id', rows[0].id)
    setWatchAtivo(newVal)
    setSavingLock(false)
  }

  async function sendReminder() {
    setSendingReminder(true)
    const ids = nonAdminPlayers.filter(p => p.payment_ok && (picksCount[p.id] || 0) === 0).map(p => p.id)
    if (ids.length === 0) {
      setReminderResult('Todos os participantes pagos já palpitaram!')
      setSendingReminder(false)
      return
    }
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Bolão Copa 2026 BEL',
          body: 'Você ainda não fez seus palpites! Não perca pontos — registre agora.',
          player_ids: ids,
        }),
      })
      const data = await res.json()
      setReminderResult(`Lembrete enviado para ${data.sent || 0} dispositivo${data.sent === 1 ? '' : 's'}.`)
    } catch {
      setReminderResult('Erro ao enviar. Tente novamente.')
    }
    setSendingReminder(false)
    setTimeout(() => { setShowReminderModal(false); setReminderResult('') }, 2500)
  }
  // Auto-sync every 30min + auto-recalc ranking while admin panel is open
  useEffect(() => {
    let syncTimer: ReturnType<typeof setTimeout> | null = null
    let recalcTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    async function doSync(thenRecalc: boolean) {
      if (cancelled) return
      setAutoSyncing(true)
      try {
        const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'manual' }) })
        const data = await res.json()
        if (data.ok) {
          const time = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
          setLastSyncTime(time)
          if (data.quotaRemaining != null) setQuotaRemaining(data.quotaRemaining)
          await fetchAll()
        }
      } catch {}
      setAutoSyncing(false)
      // Recalc 3 min after sync
      if (thenRecalc && !cancelled) {
        recalcTimer = setTimeout(async () => {
          const { error } = await supabase.rpc('recalc_all_scores')
          if (!error) { setRecalcMsg('Ranking atualizado!'); setTimeout(() => setRecalcMsg(''), 3000) }
        }, 3 * 60 * 1000)
      }
    }

    // Smart scheduler: syncs only within the active window per match
    // Active window = 10min before kickoff → until match ends (≈100min total)
    function scheduleNext() {
      if (cancelled) return
      const now = Date.now()
      const current = matchesRef.current // always up-to-date, avoids stale closure

      // 1. Live match → sync every 1min until it ends (era 5min — encurtado
      // pra dar mais precisão na notificação de gol em tempo real)
      const liveMatch = current.find(m => m.status === 'live')
      if (liveMatch) {
        doSync(true)
        syncTimer = setTimeout(scheduleNext, 1 * 60 * 1000)
        return
      }

      // 2. Find the next upcoming match (only future matches, or started < 10min ago)
      const upcoming = current
        .filter(m => m.status === 'upcoming' && m.match_date)
        .map(m => ({ m, start: new Date(m.match_date!).getTime() }))
        .filter(x => x.start > now - 10 * 60 * 1000) // future OR started < 10min ago
        .sort((a, b) => a.start - b.start)[0]

      if (!upcoming) {
        // No active or upcoming match — check again in 30min
        syncTimer = setTimeout(scheduleNext, 30 * 60 * 1000)
        return
      }

      const msUntilStart = upcoming.start - now
      const tenMinBefore = msUntilStart - 10 * 60 * 1000

      if (tenMinBefore > 0) {
        // More than 10min until kickoff — wait silently, no API calls
        syncTimer = setTimeout(() => { doSync(true); scheduleNext() }, tenMinBefore)
      } else {
        // Within the active window (T-10min to kickoff) — sync now, check in 5min
        doSync(true)
        syncTimer = setTimeout(scheduleNext, 5 * 60 * 1000)
      }
    }

    // Initial sync on load
    doSync(true)
    // Start the smart scheduler after a short delay (let matches load)
    const startTimer = setTimeout(scheduleNext, 60 * 1000)

    return () => {
      cancelled = true
      if (syncTimer) clearTimeout(syncTimer)
      if (recalcTimer) clearTimeout(recalcTimer)
      clearTimeout(startTimer)
    }
  }, [])

  // Auto-notify: check every 10 minutes when enabled
  useEffect(() => {
    if (!autoNotify) return
    async function runAutoNotify() {
      try {
        const res  = await fetch('/api/push/auto-notify', { method: 'POST' })
        const data = await res.json()
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        setLastAutoNotify(time)
        if (data.notifications?.length > 0) {
          const msgs = data.notifications.map((n: { type: string; title: string; sent: number }) =>
            `${time} — ${n.title} (${n.sent} enviado${n.sent !== 1 ? 's' : ''})`
          )
          setAutoNotifyLog(prev => [...msgs, ...prev].slice(0, 20))
        }
      } catch {}
    }
    runAutoNotify()
    const interval = setInterval(runAutoNotify, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [autoNotify])

  // Keep-alive: prevent browser from sleeping when page is open as server
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null
    async function requestWake() {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as Navigator & { wakeLock: { request(type: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
        } catch {}
      }
    }
    requestWake()
    // Re-request on visibility change (browser releases lock when tab is hidden)
    function onVisible() { if (!document.hidden && !wakeLock) requestWake() }
    document.addEventListener('visibilitychange', onVisible)
    // Heartbeat ping every 30s to keep the connection alive
    const hb = setInterval(() => { supabase.from('players').select('id').limit(1).then(() => {}) }, 30_000)
    return () => {
      wakeLock?.release().catch(() => {})
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(hb)
    }
  }, [])

  async function triggerSync() {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'manual' }) })
      const data = await res.json()
      setSyncResult(data)
      if (data.ok) {
        fetchAll()
        setLastSyncTime(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }))
        if (data.quotaRemaining != null) setQuotaRemaining(data.quotaRemaining)
      }
      // Atualiza o alerta de "sync parado" na hora, sem esperar o próximo
      // tick de 60s do polling — senão o banner continua aparecendo por até
      // 1 minuto mesmo depois de um sync manual bem-sucedido.
      checkDbSync()
    } catch { setSyncResult({ ok: false, synced: 0, updated: 0, recalculated: false, quotaRemaining: null, error: 'Erro de rede' }) }
    setSyncing(false)
  }

  async function recalcScores() {
    setRecalcing(true)
    const { error } = await supabase.rpc('recalc_all_scores')
    if (error) {
      console.error('Recalc error:', error)
      setRecalcMsg(`Erro: ${error.message}`)
    } else {
      setRecalcMsg('Pontuações recalculadas!')
      fetchAll()
    }
    setTimeout(() => setRecalcMsg(''), 5000)
    setRecalcing(false)
  }

  async function backfillAutoPicks() {
    setBackfilling(true)
    setBackfillMsg(null)
    try {
      const res = await fetch('/api/admin/backfill-auto-picks', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setBackfillMsg(json.error || 'Falha ao aplicar picks automáticos.')
      } else {
        setBackfillMsg(`${json.totalApplied} palpite${json.totalApplied === 1 ? '' : 's'} automático${json.totalApplied === 1 ? '' : 's'} aplicado${json.totalApplied === 1 ? '' : 's'} em ${json.matchesChecked} jogo${json.matchesChecked === 1 ? '' : 's'} encerrado${json.matchesChecked === 1 ? '' : 's'}. Recalcule o ranking para os pontos refletirem.`)
        fetchAll()
      }
    } catch {
      setBackfillMsg('Erro de conexão.')
    }
    setBackfilling(false)
  }

  async function calcBadges() {
    setCalcingBadges(true)
    const res = await fetch('/api/admin/badges', { method: 'POST' })
    const { granted } = await res.json()
    setBadgesMsg(`${granted} conquista${granted !== 1 ? 's' : ''} atribuida${granted !== 1 ? 's' : ''}!`)
    setTimeout(() => setBadgesMsg(''), 4000)
    setCalcingBadges(false)
  }

  async function saveExtra() {
    const val = parseFloat(String(extraAmount).replace(',', '.'))
    if (isNaN(val) || val < 0) return
    setSavingExtra(true)
    const newTotal = currentExtra + val
    const { data: rows } = await supabase.from('prize_config').select('id').limit(1)
    if (rows?.length) {
      await supabase.from('prize_config').update({ extra_amount: newTotal, extra_note: extraNote || null, updated_at: new Date().toISOString() }).eq('id', rows[0].id)
    } else {
      await supabase.from('prize_config').insert({ pct_first: 60, pct_second: 25, pct_third: 15, extra_amount: newTotal, extra_note: extraNote || null })
    }
    setCurrentExtra(newTotal); setExtraAmount(''); setExtraNote('')
    setSavingExtra(false); setExtraSaved(true)
    setTimeout(() => setExtraSaved(false), 2500)
  }

  async function resetExtra() {
    const { data: rows } = await supabase.from('prize_config').select('id').limit(1)
    if (rows?.length) await supabase.from('prize_config').update({ extra_amount: 0, extra_note: null }).eq('id', rows[0].id)
    setCurrentExtra(0)
  }

  async function savePix() {
    if (!pixCpf || !pixNome) return
    setSavingPix(true)
    const valor = parseFloat(pixValor) || 10
    let key = pixCpf.trim()
    if (pixKeyType === 'cpf') key = key.replace(/\D/g, '')
    if (pixKeyType === 'telefone') { const d = key.replace(/\D/g,''); key = d.startsWith('55') ? '+'+d : '+55'+d }
    const { data: existing } = await supabase.from('pix_config').select('id').limit(1)
    if (existing?.[0]) {
      await supabase.from('pix_config').update({ cpf: key, key_type: pixKeyType, nome: pixNome, valor, descrição: pixDesc, whatsapp: pixWhatsApp || null, group_link: pixGroupLink || null, updated_at: new Date().toISOString() }).eq('id', existing[0].id)
    } else {
      await supabase.from('pix_config').insert({ cpf: key, key_type: pixKeyType, nome: pixNome, valor, descrição: pixDesc, whatsapp: pixWhatsApp || null, group_link: pixGroupLink || null })
    }
    setSavingPix(false); setPixSaved(true)
    setTimeout(() => setPixSaved(false), 3000)
  }

  async function saveResult(match: Match) {
    if (resH === '' || resA === '') return
    setSaving(true)
    const updatePayload: Record<string, unknown> = {
      score_home: Number(resH), score_away: Number(resA), status: 'done'
    }
    if (streamUrl.trim()) updatePayload.stream_url = streamUrl.trim()
    await supabase.from('matches').update(updatePayload).eq('id', match.id)
    setSaving(false); setEditId(null)
    fetchAll(); recalcScores()
  }

  async function saveStreamUrl(matchId: string, url: string) {
    const clean = url.trim()
    await supabase.from('matches')
      .update({ stream_url: clean || null })
      .eq('id', matchId)
    setStreamUrl('')
    setEditId(null)
    fetchAll()
  }

  async function fixPlayerPick(matchId: string) {
    if (!fixPlayerId || fixHome === '' || fixAway === '') {
      setFixMsg({ type: 'error', text: 'Selecione o jogador e preencha o placar.' })
      return
    }
    setFixSaving(true)
    setFixMsg(null)
    try {
      const res = await fetch('/api/admin/fix-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: fixPlayerId, match_id: matchId,
          pick_home: fixHome, pick_away: fixAway,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFixMsg({ type: 'error', text: json.error || 'Falha ao salvar.' })
      } else {
        setFixMsg({ type: 'ok', text: 'Palpite corrigido com sucesso!' })
        setFixPlayerId(null); setFixPlayerQuery(''); setFixHome(''); setFixAway('')
        fetchAll()
      }
    } catch {
      setFixMsg({ type: 'error', text: 'Erro de conexão. Tente novamente.' })
    }
    setFixSaving(false)
  }

  async function togglePayment(p: Player) {
    setTogglingId(p.id)
    const nowPaid = !p.payment_ok
    const { error } = await supabase.from('players').update({ payment_ok: nowPaid }).eq('id', p.id)
    if (!error) {
      await fetchAll()
      const name = p.nickname || p.username
      await fetch('/api/admin/payment-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player_id: p.id, player_name: name, action: nowPaid ? 'confirmed' : 'reversed', confirmed_by: player?.username, valor: parseFloat(pixValor) || 10 }) })
      if (nowPaid) {
        await fetch('/api/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'payment_confirmed', player_id: p.id, player_name: name }) })
        // Ensure player appears in ranking immediately with 0 pts
        const { data: existing } = await supabase.from('scores').select('id').eq('player_id', p.id).maybeSingle()
        if (!existing) {
          await supabase.from('scores').insert({
            player_id:   p.id,
            total_pts:   0,
            picks_count: 0,
            f10_count:   0,
            f7_count:    0,
            f5_count:    0,
            f2_count:    0,
            f0_count:    0,
            champion_pts:0,
            updated_at:  new Date().toISOString(),
          })
        }
      }
    }
    setTogglingId(null)
  }

  async function deletePlayer(id: string) {
    await Promise.all([
      supabase.from('picks').delete().eq('player_id', id),
      supabase.from('champion_picks').delete().eq('player_id', id),
      supabase.from('scores').delete().eq('player_id', id),
      supabase.from('pick_edit_limits').delete().eq('player_id', id),
    ])
    await supabase.from('players').delete().eq('id', id)
    setConfirmDelete(null); fetchAll()
  }

  async function resetPlayerChampion(playerId: string, playerName: string) {
    setResettingChampId(playerId)
    await supabase
      .from('champion_picks')
      .update({ edit_count: 0, locked: false })
      .eq('player_id', playerId)
    setResettingChampId(null)
    setResetMsg(`Campeão de ${playerName} liberado!`)
    setTimeout(() => setResetMsg(''), 3000)
  }

  async function resetAllChampion() {
    setResettingChampAll(true)
    await supabase
      .from('champion_picks')
      .update({ edit_count: 0, locked: false })
      .neq('player_id', '00000000-0000-0000-0000-000000000000')
    setResettingChampAll(false)
    setResetMsg('Palpites de campeão de todos liberados!')
    setTimeout(() => setResetMsg(''), 4000)
  }

  async function resetPlayerPassword() {
    if (!resetPassPlayer || !newPassword || newPassword.length < 4) return
    setSavingPass(true)
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: resetPassPlayer.id, new_password: newPassword }),
    })
    const data = await res.json()
    setSavingPass(false)
    if (data.ok) {
      setPassMsg('Senha alterada com sucesso!')
      setNewPassword('')
      setTimeout(() => { setPassMsg(''); setResetPassPlayer(null) }, 2500)
    } else {
      setPassMsg(data.error || 'Erro ao alterar senha')
    }
  }

  async function resetPendingChampion() {
    setResettingChampAll(true)
    // Find players who haven't picked all 3 (no row or missing selections)
    const paidIds = players.filter(p => p.payment_ok && !p.is_admin).map(p => p.id)
    const { data: existing } = await supabase
      .from('champion_picks')
      .select('player_id, first, second, third')
      .in('player_id', paidIds)
    const pickedAll = new Set(
      (existing || [])
        .filter((r: {first:string;second:string;third:string}) => r.first && r.second && r.third)
        .map((r: {player_id:string}) => r.player_id)
    )
    const pendingIds = paidIds.filter(id => !pickedAll.has(id))
    if (pendingIds.length === 0) {
      setResetMsg('Todos os participantes pagos já fizeram o palpite de campeão!')
      setResettingChampAll(false)
      setTimeout(() => setResetMsg(''), 4000)
      return
    }
    // Reset only pending players
    await supabase
      .from('champion_picks')
      .update({ edit_count: 0, locked: false })
      .in('player_id', pendingIds)
    setResettingChampAll(false)
    setResetMsg(`Campeão liberado para ${pendingIds.length} participante${pendingIds.length !== 1 ? 's' : ''} pendentes!`)
    setTimeout(() => setResetMsg(''), 5000)
  }

  async function setMatchStatus(match: Match, status: 'live' | 'upcoming') {
    await supabase.from('matches').update({ status, ...(status === 'upcoming' ? { score_home: null, score_away: null } : {}) }).eq('id', match.id)
    fetchAll()
  }

  // Finaliza manualmente um jogo "ao vivo" com o placar já registrado no card —
  // usado quando o jogo já terminou de verdade mas o sync automático não
  // detectou isso (ex: sem ninguém com o painel aberto no momento do fim).
  async function finishLiveMatch(match: Match) {
    if (match.score_home == null || match.score_away == null) {
      alert('Edite e salve o placar final antes de finalizar este jogo.')
      return
    }
    try {
      const res = await fetch('/api/admin/finish-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: match.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || 'Falha ao finalizar o jogo.')
        return
      }
      if (json.autoApplied > 0) {
        alert(`Jogo finalizado! ${json.autoApplied} jogador${json.autoApplied === 1 ? '' : 'es'} que não palpitou recebeu palpite automático 0×0 (com 50% dos pontos). Lembre de recalcular o ranking.`)
      }
    } catch {
      alert('Erro de conexão ao finalizar o jogo.')
      return
    }
    fetchAll()
  }

  async function loadPaymentLogs() {
    const res = await fetch('/api/admin/payment-log')
    const { data } = await res.json()
    setPaymentLogs(data || [])
  }

  async function sendPush() {
    if (!pushTitle || !pushBody) return
    setPushSending(true)
    const res = await fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: pushTitle, body: pushBody }) })
    const d = await res.json()
    setPushMsg(`Enviado para ${d.sent} dispositivo${d.sent !== 1 ? 's' : ''}`)
    setPushTitle(''); setPushBody('')
    setPushSending(false)
    setTimeout(() => setPushMsg(''), 4000)
  }

  // Derived
  const nonAdminPlayers = players.filter(p => !p.is_admin)
  const filteredPlayers = nonAdminPlayers.filter(p => {
    if (playerFilter === 'paid'    && !p.payment_ok) return false
    if (playerFilter === 'pending' &&  p.payment_ok) return false
    if (playerFilter === 'nopicks' && (picksCount[p.id] || 0) > 0) return false
    if (!playerSearch) return true
    const q = playerSearch.toLowerCase()
    return (p.nickname || '').toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
  })
  const onlineCount     = nonAdminPlayers.filter(p => getPresence(p.last_seen_at).status === 'online').length
  const paidCount       = nonAdminPlayers.filter(p => p.payment_ok).length
  const pendingCount    = nonAdminPlayers.filter(p => !p.payment_ok).length
  const prizePool       = paidCount * (parseFloat(pixValor) || 10) + currentExtra
  const phases          = FASE_ORDER.filter(f => matches.some(m => m.fase === f))
  const filteredMatches = matches.filter(m => m.fase === activePhase)
  const liveMatches     = matches.filter(m => m.status === 'live')
  // Sincronização travada: há jogo ao vivo, mas o último sync registrado no
  // banco já passou de 20 minutos — sinal de que o sync parou de rodar
  // (navegador fechado, PC desligado, queda de energia, etc).
  const minutesSinceSync = dbLastSync.at ? Math.floor((Date.now() - new Date(dbLastSync.at).getTime()) / 60_000) : null
  // syncCheckLoaded evita um falso positivo: enquanto a busca ao banco ainda
  // não respondeu (logo após montar a página), minutesSinceSync é null por
  // não sabermos ainda — sem essa flag, o banner "pisca" por uma fração de
  // segundo a cada troca de aba, até a resposta real chegar.
  const syncStalled = syncCheckLoaded && liveMatches.length > 0 && (minutesSinceSync == null || minutesSinceSync > 20)
  const doneCount       = matches.filter(m => m.status === 'done').length
  const upcomingCount   = matches.filter(m => m.status === 'upcoming').length

  // Agrupa as partidas da fase ativa em seções, na ordem: Em breve → Ao vivo → Encerrados.
  // Dentro de cada seção, agrupa por data (rodada) para evitar poluição visual.
  function groupByDate(list: typeof filteredMatches) {
    const groups: { date: string; matches: typeof filteredMatches }[] = []
    const sorted = [...list].sort((a, b) => (a.match_date || '').localeCompare(b.match_date || ''))
    sorted.forEach(m => {
      const dateKey = m.match_date
        ? new Date(m.match_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' })
        : 'Sem data'
      const existing = groups.find(g => g.date === dateKey)
      if (existing) existing.matches.push(m)
      else groups.push({ date: dateKey, matches: [m] })
    })
    return groups
  }

  const upcomingInPhase = groupByDate(filteredMatches.filter(m => m.status === 'upcoming'))
  const liveInPhase     = filteredMatches.filter(m => m.status === 'live')
  const doneInPhase     = groupByDate(filteredMatches.filter(m => m.status === 'done')).reverse() // encerrados: mais recentes primeiro

  // KPIs novos
  const totalPicksMade  = Object.values(picksCount).reduce((a, b) => a + b, 0)
  const totalPicksPoss  = paidCount * matches.length
  const noPicksCount    = nonAdminPlayers.filter(p => p.payment_ok && (picksCount[p.id] || 0) === 0).length
  const topChampions    = championStats.slice(0, 3)

  // Renderiza um card de partida (reutilizado nas seções Em breve / Ao vivo / Encerrados)
  function renderMatchCard(m: typeof matches[number]) {
    return (
      <div key={m.id} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {m.status === 'live'     && <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>Ao vivo</span>}
            {m.status === 'done'     && <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">Encerrado</span>}
            {m.status === 'upcoming' && <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">Em breve</span>}
            {m.match_date && <span className="text-[11px] text-gray-400">{fmtBRT(m.match_date)}</span>}
            {m.group_name && <span className="text-[11px] text-gray-400">· {m.group_name}</span>}
          </div>
          <div className="flex gap-1.5">
            {m.status !== 'live'     && <button onClick={() => setMatchStatus(m, 'live')}     className="text-[11px] text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors">Ao vivo</button>}
            {m.status !== 'upcoming' && <button onClick={() => setMatchStatus(m, 'upcoming')} className="text-[11px] border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">Reset</button>}
            {m.status === 'live' && (
              <button onClick={() => finishLiveMatch(m)}
                title="Marca o jogo como encerrado com o placar atual — use quando o jogo já acabou de verdade mas o sync ainda não atualizou"
                className="text-[11px] font-semibold text-green-700 border border-green-200 bg-green-50 px-2.5 py-1 rounded-lg hover:bg-green-100 transition-colors">
                Finalizar jogo
              </button>
            )}
            <button onClick={() => {
                const opening = fixPickMatchId !== m.id
                setFixPickMatchId(opening ? m.id : null)
                setFixPlayerId(null); setFixPlayerQuery(''); setFixHome(''); setFixAway(''); setFixMsg(null)
              }}
              className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors border ${fixPickMatchId === m.id ? 'bg-amber-100 border-amber-300 text-amber-700' : 'border-amber-200 text-amber-600 hover:bg-amber-50'}`}>
              Corrigir palpite
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">{m.home_flag} {m.home_team}</span>
          {editId === m.id ? (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="20" value={resH} onChange={e => setResH(e.target.value)}
                  className="w-12 h-10 text-center text-[16px] font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900"/>
                <span className="text-gray-400">×</span>
                <input type="number" min="0" max="20" value={resA} onChange={e => setResA(e.target.value)}
                  className="w-12 h-10 text-center text-[16px] font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900"/>
                <button onClick={() => saveResult(m)} disabled={saving} className="text-[12px] bg-[#0099CC] text-white px-3 py-2 rounded-lg hover:bg-[#007aa8] disabled:opacity-50">{saving ? '...' : 'OK'}</button>
                <button onClick={() => setEditId(null)} className="text-[12px] border border-gray-200 px-2.5 py-2 rounded-lg hover:bg-gray-50">X</button>
              </div>
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                <input
                  type="url"
                  placeholder="Link YouTube da transmissão (opcional)"
                  value={streamUrl}
                  onChange={e => setStreamUrl(e.target.value)}
                  className="flex-1 h-8 text-[11px] border border-gray-200 rounded-lg bg-gray-50 text-gray-900 px-2 placeholder-gray-400"/>
                {streamUrl.trim() && (
                  <button onClick={() => saveStreamUrl(m.id, streamUrl)}
                    className="text-[11px] bg-red-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-600 flex-shrink-0">
                    Salvar link
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {(m.status === 'done' || m.status === 'live') && m.score_home != null
                ? <span className={`text-[18px] font-bold ${m.status === 'live' ? 'text-red-600' : 'text-gray-800'}`}>{m.score_home} × {m.score_away}</span>
                : <span className="text-gray-300 font-medium text-[15px]">vs</span>}
              <button onClick={() => { setEditId(m.id); setResH(m.score_home != null ? String(m.score_home) : ''); setResA(m.score_away != null ? String(m.score_away) : ''); setStreamUrl(m.stream_url || '') }}
                className="text-[11px] border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Editar</button>
            </div>
          )}
          <span className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">{m.away_team} {m.away_flag}</span>
        </div>
        {m.stream_url && editId !== m.id && (
          <div className="flex items-center gap-1.5 mt-1.5 px-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            <span className="text-[11px] text-red-500 font-medium">Transmissão configurada</span>
            <button onClick={() => saveStreamUrl(m.id, '')}
              className="text-[10px] text-gray-400 hover:text-red-500 underline ml-1">remover</button>
          </div>
        )}

        {/* Painel de correção manual de palpite */}
        {fixPickMatchId === m.id && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
            <p className="text-[11px] text-amber-700 font-semibold">Corrigir palpite de um jogador neste jogo</p>
            <p className="text-[10px] text-amber-600/80 leading-relaxed">
              Funciona mesmo com o jogo travado, ao vivo ou encerrado. Use só para corrigir palpites
              que o jogador comprovadamente tentou salvar e falhou por bug — não para reabrir escolha após o resultado.
            </p>

            {!fixPlayerId ? (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar jogador por nome..."
                  value={fixPlayerQuery}
                  onChange={e => setFixPlayerQuery(e.target.value)}
                  className="w-full h-9 text-[12px] border border-amber-200 rounded-lg bg-white text-gray-900 px-3 placeholder-gray-400"
                />
                {fixPlayerQuery.trim().length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {nonAdminPlayers
                      .filter(p => (p.nickname || p.username).toLowerCase().includes(fixPlayerQuery.toLowerCase()))
                      .slice(0, 8)
                      .map(p => (
                        <button key={p.id} onClick={() => { setFixPlayerId(p.id); setFixPlayerQuery(p.nickname || p.username) }}
                          className="w-full text-left px-3 py-2 text-[12px] text-gray-800 hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0">
                          {p.nickname || p.username} <span className="text-gray-400">@{p.username}</span>
                        </button>
                      ))}
                    {nonAdminPlayers.filter(p => (p.nickname || p.username).toLowerCase().includes(fixPlayerQuery.toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-[11px] text-gray-400">Nenhum jogador encontrado.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-semibold text-gray-800 bg-white border border-amber-200 px-2.5 py-1.5 rounded-lg">
                  {fixPlayerQuery}
                </span>
                <button onClick={() => { setFixPlayerId(null); setFixPlayerQuery('') }} className="text-[11px] text-gray-400 hover:text-red-500 underline">trocar</button>
                <input type="number" min="0" max="20" placeholder="0" value={fixHome} onChange={e => setFixHome(e.target.value)}
                  className="w-12 h-9 text-center text-[14px] font-bold border border-amber-200 rounded-lg bg-white text-gray-900"/>
                <span className="text-gray-400">×</span>
                <input type="number" min="0" max="20" placeholder="0" value={fixAway} onChange={e => setFixAway(e.target.value)}
                  className="w-12 h-9 text-center text-[14px] font-bold border border-amber-200 rounded-lg bg-white text-gray-900"/>
                <button onClick={() => fixPlayerPick(m.id)} disabled={fixSaving}
                  className="text-[12px] bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
                  {fixSaving ? 'Salvando...' : 'Salvar palpite'}
                </button>
              </div>
            )}

            {fixMsg && (
              <p className={`text-[11px] font-medium ${fixMsg.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{fixMsg.text}</p>
            )}
          </div>
        )}
      </div>
    )
  }


  // Nav items
  const NAV = [
    { id: 'dashboard'     as Page, label: 'Dashboard',      Icon: Ico.Dashboard,  badge: null },
    { id: 'players'       as Page, label: 'Participantes',  Icon: Ico.Users,      badge: pendingCount > 0 ? pendingCount : null },
    { id: 'matches'       as Page, label: 'Partidas',       Icon: Ico.Ball,       badge: liveMatches.length > 0 ? liveMatches.length : null },
    { id: 'pix'           as Page, label: 'PIX',            Icon: Ico.Pix,        badge: null },
    { id: 'logs'          as Page, label: 'Pagamentos',     Icon: Ico.Logs,       badge: null },
    { id: 'notifications' as Page, label: 'Notificações',   Icon: Ico.Bell,       badge: null },
    { id: 'versao'        as Page, label: 'Atualizações',   Icon: Ico.Star,       badge: null },
  ]

  if (loading || fetching || !isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  return (
    <>
      <Head>
        <title>Admin · Bolão Copa 2026 BEL</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="flex h-screen bg-gray-100 overflow-hidden">

        {/* ── SIDEBAR — desktop only ───────────────────────── */}
        <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-[#001e3c] h-screen">
          {/* Logo */}
          <div className="px-4 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <img src="/copa2026-logo.jpg" alt="Copa 2026" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
              <div>
                <p className="text-[13px] text-white font-semibold leading-tight">Bolão Copa BEL</p>
                <p className="text-[10px] text-white/40 leading-tight">Painel admin</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
            <p className="text-[9px] font-semibold text-white/25 uppercase tracking-widest px-2 pb-1.5 pt-1">Visão geral</p>
            {NAV.slice(0,3).map(({ id, label, Icon, badge }) => (
              <button key={id} onClick={() => setPage(id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all ${page === id ? 'bg-[#0099CC]/20 text-[#4dc6ef]' : 'text-white/45 hover:text-white/80 hover:bg-white/6'}`}>
                <Icon />
                <span className="flex-1 text-left">{label}</span>
                {badge !== null && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${id === 'matches' ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'}`}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
            <p className="text-[9px] font-semibold text-white/25 uppercase tracking-widest px-2 pb-1.5 pt-3">Configurações</p>
            {NAV.slice(3).map(({ id, label, Icon }) => (
              <button key={id} onClick={() => { setPage(id); if (id === 'logs') loadPaymentLogs() }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all ${page === id ? 'bg-[#0099CC]/20 text-[#4dc6ef]' : 'text-white/45 hover:text-white/80 hover:bg-white/6'}`}>
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-3 pb-4 pt-2 border-t border-white/8 space-y-1">
            <button onClick={() => router.push('/ranking')}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-white/40 hover:text-white/70 hover:bg-white/6 transition-all">
              <Ico.Eye /> Ver app
            </button>
            <button onClick={() => { logout(); router.push('/') }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-white/40 hover:text-red-400 hover:bg-white/6 transition-all">
              <Ico.Logout /> Sair
            </button>
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <div className="w-6 h-6 rounded-full bg-[#0099CC]/30 flex items-center justify-center text-[9px] font-bold text-[#4dc6ef]">
                {player?.username?.slice(0,1).toUpperCase()}
              </div>
              <span className="text-[10px] text-white/30">@{player?.username}</span>
            </div>
          </div>
        </aside>
        {/* ── MAIN ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Topbar */}
          <header className="h-12 flex-shrink-0 bg-white border-b border-gray-200 flex items-center px-3 md:px-5 gap-2 md:gap-4">

            {/* Mobile: logo */}
            <div className="flex md:hidden items-center gap-2 flex-shrink-0">
              <img src="/copa2026-logo.jpg" alt="" className="w-7 h-7 rounded-lg object-cover"/>
            </div>

            <h1 className="text-[13px] md:text-[14px] font-semibold text-gray-800 truncate">
              {page === 'dashboard' ? 'Dashboard' : page === 'players' ? 'Participantes' : page === 'matches' ? 'Partidas' : page === 'pix' ? 'PIX' : page === 'logs' ? 'Pagamentos' : page === 'versao' ? 'Atualizações' : 'Notificações'}
            </h1>

            {/* Sync status */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-400 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${autoSyncing ? 'bg-[#0099CC] animate-pulse' : 'bg-green-400'}`}/>
              {autoSyncing ? 'Sincronizando...' : lastSyncTime ? `Sync ${lastSyncTime}` : 'Sync inteligente'}
              {quotaRemaining != null && (
                <span className={`ml-1 font-semibold ${quotaRemaining < 50 ? 'text-red-500' : quotaRemaining < 200 ? 'text-amber-500' : 'text-green-600'}`}>
                  · {quotaRemaining} req
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              {(page === 'dashboard' || page === 'matches') && (
                <button onClick={triggerSync} disabled={syncing}
                  className="flex items-center gap-1 text-[11px] md:text-[12px] font-semibold text-white bg-[#0099CC] hover:bg-[#007aa8] px-2 md:px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  <span className={syncing ? 'animate-spin' : ''}><Ico.Sync /></span>
                  <span className="hidden sm:inline">
                    {syncing ? 'Sincronizando...' : lastSyncTime ? `Sync · ${lastSyncTime}` : 'Sincronizar agora'}
                  </span>
                </button>
              )}
              <button
                onClick={async () => {
                  setRefreshing(true)
                  await fetchAll()
                  if (page === 'logs') await loadPaymentLogs()
                  setRefreshing(false)
                }}
                disabled={refreshing}
                className="flex items-center gap-1 text-[11px] text-gray-500 border border-gray-200 hover:bg-gray-50 px-2 md:px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                <span className={refreshing ? 'animate-spin' : ''}><Ico.Sync /></span>
                <span className="hidden sm:inline">{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
              </button>
              {/* Mobile: logout */}
              <button onClick={() => { logout(); router.push('/') }}
                className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Ico.Logout />
              </button>
            </div>
          </header>

          {/* Content — extra bottom padding on mobile for bottom nav */}
          <main className="flex-1 overflow-y-auto p-3 md:p-5 pb-28 md:pb-5">

            {/* ── ALERTA: SYNC PARADO COM JOGO AO VIVO ── */}
            {syncStalled && (
              <div className="max-w-7xl mx-auto mb-4">
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-[13px] font-bold text-red-700">Sincronização parada com jogo ao vivo</p>
                    <p className="text-[11px] text-red-600/80">
                      {minutesSinceSync == null
                        ? 'Nenhum sync foi registrado ainda nesta sessão.'
                        : `Última sincronização há ${minutesSinceSync}min. O placar pode estar desatualizado.`}
                    </p>
                  </div>
                  <button onClick={triggerSync} disabled={syncing}
                    className="text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0">
                    {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
                  </button>
                </div>
              </div>
            )}

            {/* ── DASHBOARD ─────────────────────────────── */}
            {page === 'dashboard' && (
              <div className="max-w-7xl mx-auto space-y-4">

                {/* ── UPCOMING ALERTS ── */}
                {upcomingAlerts.length > 0 && (
                  <div className="space-y-2">
                    {upcomingAlerts.map(({ match: m, unpicked }) => {
                      const minsLeft = m.match_date
                        ? Math.round((new Date(m.match_date).getTime() - Date.now()) / 60_000)
                        : 0
                      const hLeft = Math.floor(minsLeft / 60)
                      const minLeft = minsLeft % 60
                      return (
                        <div key={m.id} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
                              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-amber-900">
                              {m.home_team} × {m.away_team}
                            </p>
                            <p className="text-[11px] text-amber-700">
                              Começa em {hLeft > 0 ? `${hLeft}h ` : ''}{minLeft}min —
                              <span className="font-semibold"> {unpicked} participante{unpicked !== 1 ? 's' : ''} sem palpite</span>
                            </p>
                          </div>
                          {pixWhatsApp && (
                            <a href={`https://wa.me/${pixWhatsApp.replace(/\D/g,'')}?text=${encodeURIComponent(`Aviso Bolão Copa BEL: ${m.home_team} × ${m.away_team} começa em ${hLeft > 0 ? `${hLeft}h ` : ''}${minLeft}min! Faça seu palpite antes de fechar!`)}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                              Cobrar no WA
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── KPI CARDS ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Participantes', value: nonAdminPlayers.length, sub: `${onlineCount} online agora`, subColor: 'text-green-600', dot: 'bg-green-400' },
                    { label: 'Pagamentos', value: `${paidCount}/${nonAdminPlayers.length}`, sub: pendingCount > 0 ? `${pendingCount} aguardando` : 'Todos confirmados', subColor: pendingCount > 0 ? 'text-amber-600' : 'text-green-600', dot: pendingCount > 0 ? 'bg-amber-400' : 'bg-green-400' },
                    { label: 'Prêmio total', value: `R$ ${prizePool.toFixed(0)}`, sub: `60% · 25% · 15%`, subColor: 'text-gray-400', dot: 'bg-[#0099CC]' },
                    { label: 'Jogos', value: `${doneCount}/${matches.length}`, sub: liveMatches.length > 0 ? `${liveMatches.length} ao vivo` : `${upcomingCount} em breve`, subColor: liveMatches.length > 0 ? 'text-red-500' : 'text-gray-400', dot: liveMatches.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-300' },
                  ].map(k => (
                    <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">{k.label}</p>
                      <p className="text-[22px] md:text-[28px] font-semibold text-gray-900 leading-none mb-1.5">{k.value}</p>
                      <p className={`text-[10px] flex items-center gap-1.5 ${k.subColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${k.dot}`}/>
                        {k.sub}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── KPI CARDS — segunda linha ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Palpites registrados */}
                  <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Palpites registrados</p>
                    <p className="text-[22px] md:text-[28px] font-semibold text-gray-900 leading-none mb-1.5">{totalPicksMade.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] flex items-center gap-1.5 text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#0099CC]"/>
                      de {totalPicksPoss.toLocaleString('pt-BR')} possíveis
                    </p>
                  </div>

                  {/* Sem palpitar + botão lembrete */}
                  <div className={`bg-white rounded-xl border p-3 md:p-4 ${noPicksCount > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Sem palpitar</p>
                    <p className={`text-[22px] md:text-[28px] font-semibold leading-none mb-2 ${noPicksCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{noPicksCount}</p>
                    {noPicksCount > 0 ? (
                      <button onClick={() => setShowReminderModal(true)}
                        className="inline-flex items-center gap-1.5 bg-[#0099CC] hover:bg-[#007aa3] text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-colors">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        Enviar lembrete
                      </button>
                    ) : (
                      <p className="text-[10px] flex items-center gap-1.5 text-green-600">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-400"/>
                        Todos palpitaram
                      </p>
                    )}
                  </div>

                  {/* Campeão mais apostado — top 3 */}
                  <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Campeão mais apostado</p>
                    {topChampions.length === 0 ? (
                      <p className="text-[12px] text-gray-400 mt-1">Nenhum palpite de campeão ainda</p>
                    ) : (
                      <div className="space-y-1.5">
                        {topChampions.map((c, i) => {
                          const pct = totalChampPicks > 0 ? Math.round((c.count / totalChampPicks) * 100) : 0
                          return (
                            <div key={c.team}>
                              <div className="flex items-center gap-2">
                                <FlagImg team={c.team} size={16}/>
                                <span className="text-[11px] text-gray-700 flex-1 truncate">{c.team}</span>
                                <span className="text-[11px] font-semibold text-gray-900">{pct}%</span>
                              </div>
                              <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: i === 0 ? '#16A34A' : i === 1 ? '#9CA3AF' : '#CBD5E1' }}/>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── LIVE MATCHES (full width when active) ── */}
                {liveMatches.length > 0 && (
                  <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
                    <div className="bg-red-50 px-4 py-2.5 flex items-center justify-between border-b border-red-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
                        <span className="text-[12px] font-bold text-red-700 uppercase tracking-wide">Ao vivo agora</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {liveLastTick && (
                          <span className="text-[10px] text-red-400">atualizado {liveLastTick}</span>
                        )}
                        <button onClick={triggerSync} disabled={syncing}
                          className="flex items-center gap-1 text-[11px] text-red-600 border border-red-200 bg-white hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                          <span className={syncing ? 'animate-spin' : ''}><Ico.Sync /></span>
                          Atualizar placar
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-red-100">
                      {liveMatches.map(m => {
                        const score = liveScores[m.id]
                        const sh = score?.h ?? m.score_home
                        const sa = score?.a ?? m.score_away
                        return (
                          <div key={m.id} className="px-5 py-4 flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-gray-400 mb-1">{m.group_name || m.fase}</p>
                              <div className="flex items-center gap-3">
                                <span className="text-[13px] font-semibold text-gray-800 truncate flex-1 text-right">{m.home_team}</span>
                                <div className="flex-shrink-0 flex items-center gap-1.5">
                                  {sh != null
                                    ? <span className="text-[22px] font-bold text-red-600 tabular-nums w-6 text-center">{sh}</span>
                                    : <span className="text-[18px] text-gray-300 w-6 text-center">-</span>
                                  }
                                  <span className="text-gray-300 text-[14px]">×</span>
                                  {sa != null
                                    ? <span className="text-[22px] font-bold text-red-600 tabular-nums w-6 text-center">{sa}</span>
                                    : <span className="text-[18px] text-gray-300 w-6 text-center">-</span>
                                  }
                                </div>
                                <span className="text-[13px] font-semibold text-gray-800 truncate flex-1">{m.away_team}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── MAIN GRID: 3 cols on desktop ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                  {/* Prize + Copa lock */}
                  <div className="space-y-4">
                    {/* Prize */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Ico.Trophy />
                        <h2 className="text-[13px] font-semibold text-gray-800">Distribuição do prêmio</h2>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { pos: '1º lugar', pct: 60, color: 'bg-amber-400' },
                          { pos: '2º lugar', pct: 25, color: 'bg-gray-300' },
                          { pos: '3º lugar', pct: 15, color: 'bg-amber-700/40' },
                        ].map(p => (
                          <div key={p.pos}>
                            <div className="flex justify-between text-[12px] mb-1">
                              <span className="text-gray-600">{p.pos} ({p.pct}%)</span>
                              <span className="font-semibold text-gray-800">R$ {(prizePool * p.pct / 100).toFixed(2).replace('.',',')}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.pct}%` }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">R$</span>
                          <input type="number" min="0" step="0.01" placeholder="0,00" value={extraAmount} onChange={e => setExtraAmount(e.target.value)}
                            className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-[12px] focus:outline-none focus:border-[#0099CC]"/>
                        </div>
                        <button onClick={saveExtra} disabled={savingExtra || !extraAmount}
                          className="px-3 py-1.5 rounded-lg bg-[#0099CC] text-white text-[12px] font-semibold hover:bg-[#007aa8] disabled:opacity-50 transition-colors">
                          {extraSaved ? 'Adicionado!' : 'Bônus'}
                        </button>
                        {currentExtra > 0 && (
                          <button onClick={resetExtra} className="px-2 py-1.5 rounded-lg border border-red-200 text-red-500 text-[12px] hover:bg-red-50 transition-colors">Zerar</button>
                        )}
                      </div>
                    </div>

                    {/* Copa lock toggle */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h2 className="text-[13px] font-semibold text-gray-800 mb-0.5">Modo Copa em andamento</h2>
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            {copaBloqueada
                              ? 'Novos cadastros estão bloqueados. Nenhum colaborador novo pode se registrar.'
                              : 'Ative para bloquear novos cadastros durante os jogos.'}
                          </p>
                        </div>
                        <button onClick={toggleCopaLock} disabled={savingLock}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50 ${copaBloqueada ? 'bg-red-500' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${copaBloqueada ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                        </button>
                      </div>
                      {copaBloqueada && (
                        <div className="mt-3 flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          <span className="text-[11px] text-red-600 font-medium">Cadastros bloqueados</span>
                        </div>
                      )}
                    </div>

                    {/* Modo visitante toggle */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h2 className="text-[13px] font-semibold text-gray-800 mb-0.5">Modo visitante</h2>
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            {modoVisitante
                              ? 'Novos colaboradores podem criar conta, mas só visualizam. Sem palpites nem campeão.'
                              : 'Ative para permitir que novos usuários acompanhem sem palpitar.'}
                          </p>
                        </div>
                        <button onClick={toggleModoVisitante} disabled={savingLock}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50 ${modoVisitante ? 'bg-blue-500' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${modoVisitante ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                        </button>
                      </div>
                      {modoVisitante && (
                        <div className="mt-3 flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span className="text-[11px] text-blue-600 font-medium">Novos usuários só podem visualizar</span>
                        </div>
                      )}
                    </div>

                    {/* Watch toggle */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h2 className="text-[13px] font-semibold text-gray-800 mb-0.5">Aba "Assistir" no menu</h2>
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            {watchAtivo
                              ? 'Botão "Assistir" visível no menu inferior para todos os jogadores.'
                              : 'Botão "Assistir" oculto. Ative quando houver jogo ao vivo para transmitir.'}
                          </p>
                        </div>
                        <button onClick={toggleWatchAtivo} disabled={savingLock}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50 ${watchAtivo ? 'bg-[#0099CC]' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${watchAtivo ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                        </button>
                      </div>
                      {watchAtivo && (
                        <div className="mt-3 flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          <span className="text-[11px] text-[#0099CC] font-medium">Menu com botão Assistir ativo para os jogadores</span>
                        </div>
                      )}
                    </div>

                    {/* Champion lock toggle */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h2 className="text-[13px] font-semibold text-gray-800 mb-0.5">Travamento dos jogos</h2>
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            {travamentoJogos
                              ? 'Palpites travados 2h antes de cada jogo. Comportamento padrão.'
                              : 'Travamento desligado. Jogadores podem editar jogos ainda não iniciados.'}
                          </p>
                        </div>
                        <button onClick={toggleTravamentoJogos} disabled={savingLock}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50 ${travamentoJogos ? 'bg-[#0099CC]' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${travamentoJogos ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                        </button>
                      </div>
                      {!travamentoJogos && (
                        <div className="mt-3 flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                          <span className="text-[11px] text-amber-700 font-medium">Palpites desbloqueados para alteração</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h2 className="text-[13px] font-semibold text-gray-800 mb-0.5">Prazo do palpite de campeão</h2>
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            {champBloqueado
                              ? 'Palpite de campeão está bloqueado. Ninguém pode escolher ou alterar.'
                              : 'Ative para bloquear os palpites de campeão, vice e 3º lugar.'}
                          </p>
                        </div>
                        <button onClick={toggleChampLock} disabled={savingLock}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50 ${champBloqueado ? 'bg-red-500' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${champBloqueado ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                        </button>
                      </div>
                      {champBloqueado && (
                        <div className="mt-3 flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          <span className="text-[11px] text-red-600 font-medium">Palpite de campeão bloqueado</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Phase progress + Ranking top 5 */}
                  <div className="space-y-4">
                    {/* Phase progress */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        <h2 className="text-[13px] font-semibold text-gray-800">Progresso da Copa</h2>
                      </div>
                      <div className="space-y-3">
                        {FASE_ORDER.map(fase => {
                          const total = matches.filter(m => m.fase === fase).length
                          const done  = matches.filter(m => m.fase === fase && m.status === 'done').length
                          const live  = matches.filter(m => m.fase === fase && m.status === 'live').length
                          if (total === 0) return null
                          const pct = total > 0 ? Math.round((done / total) * 100) : 0
                          return (
                            <div key={fase}>
                              <div className="flex justify-between text-[11px] mb-1">
                                <span className="text-gray-600 flex items-center gap-1.5">
                                  {live > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>}
                                  {fase === 'Fase de Grupos' ? 'Grupos' : fase}
                                </span>
                                <span className="text-gray-400">{done}/{total}</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-400' : live > 0 ? 'bg-red-400' : 'bg-[#0099CC]'}`}
                                  style={{ width: `${pct}%` }}/>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Ranking top 5 */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Ico.Trophy />
                          <h2 className="text-[13px] font-semibold text-gray-800">Ranking ao vivo</h2>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400"/>
                          <span className="text-[10px] text-gray-400">atualiza a cada 30s</span>
                        </div>
                      </div>
                      {rankingTop5.length === 0 ? (
                        <p className="text-[12px] text-gray-400 text-center py-4">Nenhuma pontuação ainda</p>
                      ) : (
                        <div className="space-y-2">
                          {rankingTop5.map((r, i) => {
                            const pos = i + 1
                            const medal = pos === 1 ? 'text-amber-500' : pos === 2 ? 'text-gray-400' : pos === 3 ? 'text-amber-700' : 'text-gray-300'
                            const av = r.avatar ? (r.avatar.startsWith('http') ? r.avatar : supabase.storage.from('avatars').getPublicUrl(r.avatar).data.publicUrl) : null
                            return (
                              <div key={r.player_id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${pos === 1 ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
                                <span className={`text-[14px] font-bold w-5 text-center flex-shrink-0 ${medal}`}>{pos}</span>
                                {av
                                  ? <img src={av} alt={r.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0"/>
                                  : <div className="w-7 h-7 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[9px] font-bold text-[#0099CC] flex-shrink-0">
                                      {r.name.split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()}
                                    </div>
                                }
                                <span className="flex-1 text-[12px] font-medium text-gray-800 truncate">{r.name}</span>
                                <span className={`text-[13px] font-bold flex-shrink-0 ${pos <= 3 ? 'text-[#0099CC]' : 'text-gray-500'}`}>{r.pts} pts</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <button onClick={() => setPage('players')} className="mt-3 w-full text-[11px] text-[#0099CC] hover:underline text-center block">
                        Ver ranking completo
                      </button>
                    </div>
                  </div>

                  {/* Participants + Upcoming matches */}
                  <div className="space-y-4">
                    {/* Participants */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Ico.Users />
                          <h2 className="text-[13px] font-semibold text-gray-800">Participantes</h2>
                        </div>
                        <button onClick={() => setPage('players')} className="text-[11px] text-[#0099CC] hover:underline">Ver todos</button>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Pagamentos</span>
                          <span className="font-semibold text-gray-700">{paidCount}/{nonAdminPlayers.length}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#0099CC] rounded-full transition-all"
                            style={{ width: nonAdminPlayers.length > 0 ? `${Math.round((paidCount/nonAdminPlayers.length)*100)}%` : '0%' }}/>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {nonAdminPlayers.slice(0, 5).map(p => {
                          const av = p.avatar_url ? (p.avatar_url.startsWith('http') ? p.avatar_url : supabase.storage.from('avatars').getPublicUrl(p.avatar_url).data.publicUrl) : null
                          const name = p.nickname || p.username
                          const presence = getPresence(p.last_seen_at)
                          const picks = picksCount[p.id] || 0
                          return (
                            <div key={p.id} className="flex items-center gap-2.5 py-2">
                              <div className="relative flex-shrink-0">
                                {av
                                  ? <img src={av} alt={name} className="w-7 h-7 rounded-full object-cover"/>
                                  : <div className="w-7 h-7 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[9px] font-bold text-[#0099CC]">
                                      {(name||'?').split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()}
                                    </div>
                                }
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${presence.status === 'online' ? 'bg-green-500' : presence.status === 'recent' ? 'bg-amber-400' : 'bg-gray-300'}`}/>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-gray-800 truncate">{name}</p>
                                <p className="text-[9px] text-gray-400">{picks} palpites</p>
                              </div>
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${p.payment_ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {p.payment_ok ? 'Pago' : 'Pendente'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Upcoming matches */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Ico.Ball />
                          <h2 className="text-[13px] font-semibold text-gray-800">Próximas partidas</h2>
                        </div>
                        <button onClick={() => setPage('matches')} className="text-[11px] text-[#0099CC] hover:underline">Ver todas</button>
                      </div>
                      <div className="space-y-2">
                        {matches.filter(m => m.status === 'upcoming').slice(0, 5).map(m => (
                          <div key={m.id} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-gray-700 truncate">{m.home_team} × {m.away_team}</p>
                              {m.group_name && <p className="text-[9px] text-gray-400">{m.group_name}</p>}
                            </div>
                            {m.match_date && (
                              <p className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{fmtBRT(m.match_date)}</p>
                            )}
                          </div>
                        ))}
                        {matches.filter(m => m.status === 'upcoming').length === 0 && (
                          <p className="text-[12px] text-gray-400 py-2 text-center">Nenhuma partida agendada</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── ACTION CARDS ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                  {/* Sync */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <button onClick={triggerSync} disabled={syncing}
                      className="w-full flex items-center justify-center gap-2 bg-[#0099CC] text-white rounded-lg py-2.5 text-[13px] font-semibold hover:bg-[#007aa8] disabled:opacity-50 transition-colors mb-3">
                      <span className={syncing ? 'animate-spin' : ''}><Ico.Sync /></span>
                      {syncing ? 'Sincronizando...' : 'Sincronizar API'}
                    </button>
                    <div className="space-y-1">
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Busca jogos e placares na The Odds API. <strong>Sync inteligente:</strong> sincroniza 10min antes do jogo, a cada 10min durante a partida e 10min após o fim. Recalcula o ranking 5min depois de cada sync.
                      </p>
                      {lastSyncTime && (
                        <p className="text-[10px] text-gray-400">Último: {lastSyncTime}</p>
                      )}
                      {quotaRemaining != null && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${quotaRemaining < 50 ? 'bg-red-400' : quotaRemaining < 200 ? 'bg-amber-400' : 'bg-green-400'}`}
                              style={{ width: `${Math.min(100, (quotaRemaining / 500) * 100)}%` }}/>
                          </div>
                          <span className={`text-[10px] font-semibold whitespace-nowrap ${quotaRemaining < 50 ? 'text-red-500' : quotaRemaining < 200 ? 'text-amber-500' : 'text-green-600'}`}>
                            {quotaRemaining} req
                          </span>
                        </div>
                      )}
                      {!lastSyncTime && (
                        <p className="text-[10px] text-[#0099CC] font-medium">Sync automático desativado — manual salva quota</p>
                      )}
                    </div>
                  </div>

                  {/* Recalculate */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <button onClick={recalcScores} disabled={recalcing}
                      className="w-full flex items-center justify-center gap-2 bg-gray-800 text-white rounded-lg py-2.5 text-[13px] font-semibold hover:bg-gray-900 disabled:opacity-50 transition-colors mb-3">
                      {recalcing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Ico.Star />}
                      Recalcular ranking
                    </button>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Recalcula pontos de todos. Use <strong>após confirmar resultados</strong> manualmente ou depois de sincronizar.
                    </p>
                    {recalcMsg && <p className={`text-[10px] mt-1.5 font-medium ${recalcMsg.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>{recalcMsg}</p>}
                  </div>

                  {/* Backfill picks automáticos */}
                  <div className="bg-white border border-amber-200 rounded-xl p-4">
                    <button onClick={backfillAutoPicks} disabled={backfilling}
                      className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white rounded-lg py-2.5 text-[13px] font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors mb-3">
                      {backfilling ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : null}
                      Aplicar palpites automáticos pendentes
                    </button>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Cria o palpite 0×0 (50% dos pontos) para quem esqueceu de palpitar em jogos <strong>já encerrados</strong>. Use uma vez para aplicar retroativamente; daqui pra frente isso já acontece automaticamente quando cada jogo encerra.
                    </p>
                    {backfillMsg && (
                      <p className="text-[11px] font-medium text-amber-700 mt-2">{backfillMsg}</p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <button onClick={calcBadges} disabled={calcingBadges}
                      className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white rounded-lg py-2.5 text-[13px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors mb-3">
                      {calcingBadges ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Ico.Trophy />}
                      Calc. conquistas
                    </button>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Atribui badges como Vidente, Atirador de Elite etc. Use <strong>ao fim de cada fase</strong>.
                    </p>
                    {badgesMsg && <p className="text-[10px] text-amber-600 mt-1.5 font-medium">{badgesMsg}</p>}
                  </div>

                  {/* Payments */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <button onClick={() => setPage('players')}
                      className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-[13px] font-semibold hover:bg-gray-50 transition-colors mb-3">
                      <Ico.Users />
                      Confirmar pagamentos
                      {pendingCount > 0 && <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
                    </button>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {pendingCount > 0
                        ? <><strong className="text-amber-600">{pendingCount} participante{pendingCount !== 1 ? 's' : ''}</strong> aguardando confirmação de pagamento.</>
                        : 'Todos os participantes pagos estão confirmados.'
                      }
                    </p>
                  </div>
                </div>

                {syncResult && (
                  <div className={`rounded-xl px-4 py-3 text-[12px] ${syncResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                    {syncResult.ok
                      ? `Sincronizado: +${syncResult.synced} novos · ${syncResult.updated} atualizados${
                          (syncResult.goalEvents?.length ?? 0) > 0
                            ? ` · ⚽ ${syncResult.goalEvents!.length} gol(s) detectado(s), ${syncResult.goalsNotified ?? 0} notificação(ões) enviada(s)`
                            : ''
                        }`
                      : `Erro: ${syncResult.error}`}
                  </div>
                )}
              </div>
            )}

            {/* ── PARTICIPANTES ──────────────────────────── */}
            {page === 'players' && (
              <div className="max-w-3xl mx-auto space-y-4">

                {/* Stats bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Total',      value: nonAdminPlayers.length, color: 'text-gray-800' },
                    { label: 'Pagos',      value: paidCount,              color: 'text-green-600' },
                    { label: 'Pendentes',  value: pendingCount,           color: 'text-amber-600' },
                    { label: 'Com notif.', value: pushEnabled.size,       color: 'text-[#0099CC]' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                      <p className={`text-[22px] font-semibold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Top 5 — mais tempo no app */}
                {nonAdminPlayers.some(p => (p.total_online_seconds || 0) > 0) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <h3 className="text-[12px] font-bold text-gray-700">Mais tempo no app</h3>
                    </div>
                    <div className="space-y-2">
                      {[...nonAdminPlayers]
                        .sort((a, b) => (b.total_online_seconds || 0) - (a.total_online_seconds || 0))
                        .slice(0, 5)
                        .map((p, i) => {
                          const name = p.nickname || p.username
                          const av = p.avatar_url ? (p.avatar_url.startsWith('http') ? p.avatar_url : supabase.storage.from('avatars').getPublicUrl(p.avatar_url).data.publicUrl) : null
                          return (
                            <div key={p.id} className="flex items-center gap-2.5">
                              <span className="text-[11px] font-bold text-gray-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                              {av
                                ? <img src={av} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0"/>
                                : <div className="w-7 h-7 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[9px] font-bold text-[#0099CC] flex-shrink-0">
                                    {(name||'?').split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()}
                                  </div>
                              }
                              <span className="text-[12px] font-medium text-gray-800 flex-1 truncate">{name}</span>
                              <span className="text-[11px] font-bold text-[#0099CC] flex-shrink-0">{formatOnlineTime(p.total_online_seconds)}</span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Payment progress */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
                  <div className="flex justify-between text-[12px] mb-2">
                    <span className="font-semibold text-gray-700">Progresso de pagamentos</span>
                    <span className="text-[#0099CC] font-bold">R$ {prizePool.toFixed(0)} arrecadados</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0099CC] rounded-full transition-all"
                      style={{ width: nonAdminPlayers.length > 0 ? `${Math.round((paidCount/nonAdminPlayers.length)*100)}%` : '0%' }}/>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">{paidCount} de {nonAdminPlayers.length} confirmados ({nonAdminPlayers.length > 0 ? Math.round((paidCount/nonAdminPlayers.length)*100) : 0}%)</p>
                </div>

                {/* Reset panels — separated by type */}
                <div className="grid grid-cols-1 gap-3">
                  {/* Champion reset */}
                  <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-gray-800">Liberar palpite de campeão</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">Reseta o limite de 3 trocas do palpite de campeão, vice e 3º lugar.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {/* Liberar só os pendentes — botão principal */}
                      <button onClick={resetPendingChampion} disabled={resettingChampAll}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                        {resettingChampAll
                          ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        }
                        Liberar pendentes
                      </button>
                      {/* Liberar todos — secundário */}
                      <button onClick={resetAllChampion} disabled={resettingChampAll}
                        className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
                        Liberar todos
                      </button>
                    </div>
                  </div>
                </div>

                {/* Toast */}
                {resetMsg && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <p className="text-[12px] text-green-700 font-medium">{resetMsg}</p>
                  </div>
                )}

                {/* Filter tabs */}
                <div className="flex gap-2">
                  {([
                    { id: 'all',     label: 'Todos',          count: nonAdminPlayers.length,                                               color: 'gray'  },
                    { id: 'paid',    label: 'Pagos',           count: paidCount,                                                            color: 'green' },
                    { id: 'pending', label: 'Pendentes',       count: pendingCount,                                                         color: 'amber' },
                    { id: 'nopicks', label: 'Sem palpites',    count: nonAdminPlayers.filter(p => (picksCount[p.id] || 0) === 0).length,   color: 'red'   },
                  ] as const).map(f => (
                    <button key={f.id}
                      onClick={() => { setPlayerFilter(f.id); setPlayerPage(0) }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all ${
                        playerFilter === f.id
                          ? f.color === 'green' ? 'bg-green-500 text-white border-green-500'
                          : f.color === 'amber' ? 'bg-amber-500 text-white border-amber-500'
                          : f.color === 'red'   ? 'bg-red-500 text-white border-red-500'
                          : 'bg-gray-800 text-white border-gray-800'
                          : f.color === 'green' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : f.color === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : f.color === 'red'   ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}>
                      {f.label}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        playerFilter === f.id ? 'bg-white/25 text-white'
                        : f.color === 'green' ? 'bg-green-100 text-green-700'
                        : f.color === 'amber' ? 'bg-amber-100 text-amber-700'
                        : f.color === 'red'   ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-600'
                      }`}>{f.count}</span>
                    </button>
                  ))}
                </div>

                {/* Search + legend */}
                {pushEnabled.size === 0 && nonAdminPlayers.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-amber-800">Nenhuma notificação registrada ainda</p>
                      <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                        Verifique se as variáveis <code className="bg-amber-100 px-1 rounded">VAPID_PUBLIC_KEY</code>, <code className="bg-amber-100 px-1 rounded">VAPID_PRIVATE_KEY</code> e <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> estão configuradas na Vercel e se o arquivo <code className="bg-amber-100 px-1 rounded">public/sw.js</code> existe no repositório.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" placeholder="Buscar por nome ou usuário..." value={playerSearch}
                      onChange={e => { setPlayerSearch(e.target.value); setPlayerPage(0) }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-[13px] focus:outline-none focus:border-[#0099CC] transition-colors"/>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-white border border-gray-200 rounded-xl px-3 py-2.5 whitespace-nowrap">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"/>Online</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"/>Recente</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300"/>Off</span>
                    <span className="sr-only">{presenceTick}</span>
                  </div>
                </div>

                {/* Player list — paginated 20 per page */}
                {(() => {
                  const PAGE_SIZE = 20
                  const totalPages = Math.ceil(filteredPlayers.length / PAGE_SIZE)
                  const paginated  = filteredPlayers.slice(playerPage * PAGE_SIZE, (playerPage + 1) * PAGE_SIZE)
                  return (
                    <>
                      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                        {paginated.map((p, idx) => {
                          const rowNumber = playerPage * 20 + idx + 1
                          const av = p.avatar_url ? (p.avatar_url.startsWith('http') ? p.avatar_url : supabase.storage.from('avatars').getPublicUrl(p.avatar_url).data.publicUrl) : null
                          const name = p.nickname || p.username
                          const presence = getPresence(p.last_seen_at)
                          const picks = picksCount[p.id] || 0
                          return (
                            <div key={p.id} className="px-3 py-3 sm:px-4">
                              {/* Row 1: number + avatar + info + payment */}
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-bold text-gray-300 w-5 text-right flex-shrink-0">{rowNumber}</span>
                                <div className="relative flex-shrink-0">
                                  {av
                                    ? <img src={av} alt={name} className="w-9 h-9 rounded-full object-cover"/>
                                    : <div className="w-9 h-9 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[10px] font-bold text-[#0099CC]">
                                        {(name||'?').split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()}
                                      </div>
                                  }
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${presence.status === 'online' ? 'bg-green-500' : presence.status === 'recent' ? 'bg-amber-400' : 'bg-gray-300'}`}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-[13px] font-semibold text-gray-900 truncate">{name}</p>
                                    {presence.status === 'online' && <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">ONLINE</span>}
                                    {pushEnabled.has(p.id)
                                      ? <span className="text-[9px] font-semibold text-[#0099CC] bg-[#E6F4FA] px-1.5 py-0.5 rounded flex items-center gap-1">
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                                          Notif.
                                        </span>
                                      : <span className="text-[9px] text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M17.73 17.73A10.06 10.06 0 0 1 6 8c0-.34.02-.67.05-1"/><path d="M10.27 6.27A6 6 0 0 1 18 8c0 2.68-.54 4.9-1.4 6.59"/><path d="M21 21H3"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                                          Sem
                                        </span>
                                    }
                                  </div>
                                  <p className="text-[11px] text-gray-400">@{p.username} · {picks} palpites · {presence.label} · {formatOnlineTime(p.total_online_seconds)} no app</p>
                                </div>
                                {/* Payment button */}
                                <button onClick={() => togglePayment(p)} disabled={togglingId === p.id}
                                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-60 ${p.payment_ok ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
                                  {togglingId === p.id
                                    ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin"/>
                                    : p.payment_ok ? <><Ico.Check /><span className="hidden sm:inline">Confirmado</span></> : <span>Confirmar</span>
                                  }
                                </button>
                              </div>
                              {/* Row 2: actions */}
                              <div className="flex items-center gap-1.5 mt-2 ml-[52px]">

                                {/* Reset champion */}
                                <button onClick={() => resetPlayerChampion(p.id, name)} disabled={resettingChampId === p.id}
                                  className="flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">
                                  {resettingChampId === p.id
                                    ? <span className="w-3 h-3 border border-blue-400/30 border-t-blue-500 rounded-full animate-spin"/>
                                    : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/></svg>
                                  }
                                  Liberar campeão
                                </button>
                                {/* Reset password */}
                                <button onClick={() => { setResetPassPlayer(p); setNewPassword(''); setPassMsg('') }}
                                  className="flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                  Senha
                                </button>
                                <div className="flex-1"/>
                                {/* Delete */}
                                <button onClick={() => setConfirmDelete(p.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                  <Ico.Trash />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                        {paginated.length === 0 && (
                          <div className="text-center py-10 text-gray-400 text-[13px]">
                            {playerSearch ? `Nenhum participante encontrado para "${playerSearch}"` : 'Nenhum participante ainda.'}
                          </div>
                        )}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                          <p className="text-[12px] text-gray-400">
                            {playerPage * PAGE_SIZE + 1}–{Math.min((playerPage + 1) * PAGE_SIZE, filteredPlayers.length)} de {filteredPlayers.length}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setPlayerPage(p => Math.max(0, p - 1))} disabled={playerPage === 0}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i).map(i => {
                              const show = i === 0 || i === totalPages - 1 || Math.abs(i - playerPage) <= 1
                              if (!show) {
                                // Show ellipsis once between gaps
                                const prevShown = i - 1 === 0 || Math.abs((i-1) - playerPage) <= 1
                                if (prevShown) return <span key={i} className="text-gray-300 text-[12px] px-1">…</span>
                                return null
                              }
                              return (
                                <button key={i} onClick={() => setPlayerPage(i)}
                                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-semibold transition-colors ${
                                    i === playerPage ? 'bg-[#0099CC] text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                                  }`}>
                                  {i + 1}
                                </button>
                              )
                            })}
                            <button onClick={() => setPlayerPage(p => Math.min(totalPages - 1, p + 1))} disabled={playerPage === totalPages - 1}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18"/></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            {/* ── PARTIDAS ───────────────────────────────── */}
            {page === 'matches' && (
              <div className="max-w-3xl mx-auto space-y-4">
                {/* Status summary — clicável, muda a sub-aba */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Ao vivo',    count: liveMatches.length, color: 'text-red-600',  bg: 'bg-red-50 border-red-200',  view: 'jogos' as const },
                    { label: 'Em breve',   count: upcomingCount,      color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', view: 'jogos' as const },
                    { label: 'Encerrados', count: doneCount,          color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', view: 'historico' as const },
                  ].map(s => (
                    <button key={s.label} onClick={() => setMatchView(s.view)}
                      className={`rounded-xl border p-3 text-center transition-all ${s.bg} ${matchView === s.view ? 'ring-2 ring-offset-1 ring-[#0099CC]/40' : 'hover:opacity-80'}`}>
                      <p className={`text-[22px] font-semibold ${s.color}`}>{s.count}</p>
                      <p className={`text-[11px] ${s.color} opacity-80`}>{s.label}</p>
                    </button>
                  ))}
                </div>

                {/* Sub-abas: Jogos (ao vivo + em breve) vs Histórico (encerrados) */}
                <div className="flex gap-2">
                  <button onClick={() => setMatchView('jogos')}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${matchView === 'jogos' ? 'bg-[#0099CC] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#0099CC]/40'}`}>
                    Jogos
                  </button>
                  <button onClick={() => setMatchView('historico')}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${matchView === 'historico' ? 'bg-gray-700 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                    Histórico ({doneCount})
                  </button>
                </div>

                {/* Phase filter */}
                <div className="flex gap-2 flex-wrap">
                  {phases.map(f => (
                    <button key={f} onClick={() => setActivePhase(f)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all ${activePhase === f ? 'bg-[#0099CC] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#0099CC]/40'}`}>
                      {f === 'Fase de Grupos' ? 'Grupos' : f} ({matches.filter(m => m.fase === f).length})
                    </button>
                  ))}
                </div>

                {activePhase === 'Fase de Grupos' && (
                  <GroupLabelEditor/>
                )}

                {/* Match list */}
                <div className="space-y-4">

                  {matchView === 'jogos' ? (
                    <>
                      {/* AO VIVO — sempre fixo no topo, nunca enterrado embaixo de "Em breve" */}
                      {liveInPhase.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
                            <h3 className="text-[12px] font-bold text-red-600 uppercase tracking-wide">Ao vivo agora</h3>
                            <span className="text-[11px] text-gray-400">({liveInPhase.length})</span>
                          </div>
                          <div className="bg-white rounded-xl border border-red-100 divide-y divide-gray-100">
                            {liveInPhase.map(renderMatchCard)}
                          </div>
                        </div>
                      )}

                      {/* EM BREVE — agrupado por rodada/data, mais próximo primeiro */}
                      {upcomingInPhase.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                            <h3 className="text-[12px] font-bold text-blue-600 uppercase tracking-wide">Em breve</h3>
                            <span className="text-[11px] text-gray-400">({filteredMatches.filter(m => m.status === 'upcoming').length})</span>
                          </div>
                          {upcomingInPhase.map(group => (
                            <div key={group.date} className="mb-3">
                              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">{group.date}</p>
                              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                                {group.matches.map(renderMatchCard)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {liveInPhase.length === 0 && upcomingInPhase.length === 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                          <p className="text-[13px] text-gray-400">Nenhum jogo ao vivo ou em breve nesta fase.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* HISTÓRICO — só encerrados, agrupado por data, mais recentes primeiro */}
                      {doneInPhase.length > 0 ? doneInPhase.map(group => (
                        <div key={group.date} className="mb-3">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">{group.date}</p>
                          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                            {group.matches.map(renderMatchCard)}
                          </div>
                        </div>
                      )) : (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                          <p className="text-[13px] text-gray-400">Nenhum jogo encerrado nesta fase ainda.</p>
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>
            )}

            {/* ── PIX ────────────────────────────────────── */}
            {page === 'pix' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-[14px] font-semibold text-gray-800 mb-1">Configurar chave PIX</h2>
                  <p className="text-[12px] text-gray-400 mb-5">Os participantes verão o QR Code para pagar a inscrição</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Tipo de chave</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(['cpf','telefone','email','aleatória'] as PixKeyType[]).map(type => (
                          <button key={type} onClick={() => { setPixKeyType(type); setPixCpf('') }}
                            className={`py-2.5 rounded-xl text-[12px] font-semibold border transition-all ${pixKeyType === type ? 'bg-[#0099CC] text-white border-[#0099CC]' : 'bg-white text-gray-500 border-gray-200 hover:border-[#0099CC]/40'}`}>
                            {type === 'cpf' ? 'CPF' : type === 'telefone' ? 'Telefone' : type === 'email' ? 'E-mail' : 'Aleatória'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Chave PIX</label>
                      <input type={pixKeyType === 'email' ? 'email' : 'text'}
                        placeholder={pixKeyType === 'cpf' ? '000.000.000-00' : pixKeyType === 'telefone' ? '(11) 99999-9999' : pixKeyType === 'email' ? 'exemplo@email.com' : 'Cole a chave aleatória aqui'}
                        value={pixCpf} onChange={e => setPixCpf(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC] font-mono"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Beneficiário</label>
                        <input type="text" placeholder="Nome completo" value={pixNome} onChange={e => setPixNome(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC]"/>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Valor (R$)</label>
                        <input type="number" min="1" step="0.01" value={pixValor} onChange={e => setPixValor(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC]"/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Descrição</label>
                      <input type="text" value={pixDesc} onChange={e => setPixDesc(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC]"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">WhatsApp suporte</label>
                        <input type="tel" placeholder="(91) 99999-9999" value={pixWhatsApp} onChange={e => setPixWhatsApp(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC]"/>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Link do grupo WhatsApp</label>
                        <input type="url" placeholder="https://chat.whatsapp.com/..." value={pixGroupLink} onChange={e => setPixGroupLink(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[13px] focus:outline-none focus:border-[#0099CC] font-mono"/>
                      </div>
                    </div>
                    <button onClick={savePix} disabled={savingPix || !pixCpf || !pixNome}
                      className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${pixSaved ? 'bg-green-500 text-white' : 'bg-[#0099CC] text-white hover:bg-[#007aa8] disabled:opacity-50'}`}>
                      {savingPix ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : pixSaved ? <><Ico.Check /> Salvo!</> : 'Salvar configuração PIX'}
                    </button>
                  </div>
                </div>

                {pixCpf && pixNome && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-[13px] font-semibold text-green-800 mb-1">PIX configurado</p>
                    <p className="text-[12px] text-green-600">
                      {getKeyTypeLabel(pixKeyType)}: {formatPixKeyDisplay(pixCpf, pixKeyType)} · {pixNome}
                    </p>
                    {pixWhatsApp && <p className="text-[12px] text-green-600 mt-0.5">Suporte: {pixWhatsApp}</p>}
                    {pixGroupLink && <p className="text-[12px] text-green-600 mt-0.5 truncate">Grupo: {pixGroupLink}</p>}
                  </div>
                )}
              </div>
            )}

            {/* ── LOGS ───────────────────────────────────── */}
            {page === 'logs' && (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <p className="text-[24px] font-semibold text-green-600">{paymentLogs.filter(l=>l.action==='confirmed').length}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Confirmados</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <p className="text-[24px] font-semibold text-[#0099CC]">R$ {(paymentLogs.filter(l=>l.action==='confirmed').reduce((s,l) => s + Number(l.valor), 0)).toFixed(0)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Total confirmado</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {paymentLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3 opacity-40"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      <p className="text-[13px]">Nenhum registro ainda.</p>
                    </div>
                  ) : paymentLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-4 px-4 py-3.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${log.action === 'confirmed' ? 'bg-green-100' : 'bg-red-100'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={log.action === 'confirmed' ? '#16A34A' : '#DC2626'} strokeWidth="2.5" strokeLinecap="round">
                          {log.action === 'confirmed' ? <polyline points="20 6 9 17 4 12"/> : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900">{log.player_name}</p>
                        <p className="text-[11px] text-gray-400">{log.action === 'confirmed' ? 'Confirmado' : 'Revertido'} por @{log.confirmed_by} · R$ {Number(log.valor).toFixed(2).replace('.',',')}</p>
                      </div>
                      <p className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                        {new Date(log.created_at).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── NOTIFICAÇÕES ──────────────────────────── */}
            {page === 'notifications' && (
              <div className="max-w-2xl mx-auto space-y-4">

                {/* Notificações automáticas */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-[14px] font-semibold text-gray-800">Notificações automáticas</h2>
                      <p className="text-[12px] text-gray-400 mt-0.5">Avisa os colaboradores automaticamente nos momentos certos</p>
                    </div>
                    <button onClick={() => setAutoNotify(v => !v)}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${autoNotify ? 'bg-[#0099CC]' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoNotify ? 'translate-x-6' : 'translate-x-0.5'}`}/>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-blue-50 text-blue-600', title: '2 horas antes de cada jogo', desc: 'Avisa todos para fazerem ou revisarem o palpite antes do fechamento.', example: '"⚽ Jogo em 2 horas! Brasil × México começa às 15h. Faça seu palpite!"' },
                      { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-green-50 text-green-600', title: 'Quando o resultado for confirmado', desc: 'Após salvar o placar, todos recebem o resultado e são convidados a ver a pontuação.', example: '"⚽ Brasil venceu! Brasil 2×0 México. Confira o placar e sua pontuação!"' },
                    ].map((item, i) => (
                      <div key={i} className={`rounded-xl p-3.5 ${autoNotify ? item.color.split(' ')[0] : 'bg-gray-50'} border ${autoNotify ? 'border-current/10' : 'border-gray-100'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${autoNotify ? item.color : 'bg-gray-200 text-gray-400'}`}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={item.icon}/></svg>
                          </div>
                          <div className="flex-1">
                            <p className={`text-[12px] font-semibold ${autoNotify ? 'text-gray-800' : 'text-gray-400'}`}>{item.title}</p>
                            <p className={`text-[11px] mt-0.5 leading-relaxed ${autoNotify ? 'text-gray-500' : 'text-gray-400'}`}>{item.desc}</p>
                            <p className={`text-[10px] mt-1.5 font-mono leading-relaxed ${autoNotify ? 'text-gray-400' : 'text-gray-300'}`}>{item.example}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <span className={`w-2 h-2 rounded-full ${autoNotify ? 'bg-green-400' : 'bg-gray-300'}`}/>
                      {autoNotify ? `Verificando a cada 10 min${lastAutoNotify ? ` · última verificação: ${lastAutoNotify}` : ''}` : 'Desativado'}
                    </div>
                    <button onClick={async () => {
                      const res = await fetch('/api/push/auto-notify', { method: 'POST' })
                      const data = await res.json()
                      const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      setLastAutoNotify(time)
                      if (data.notifications?.length > 0) {
                        const msgs = data.notifications.map((n: { title: string; sent: number }) => `${time} — ${n.title} (${n.sent} enviado${n.sent !== 1 ? 's' : ''})`)
                        setAutoNotifyLog(prev => [...msgs, ...prev].slice(0, 20))
                        setPushMsg(`${data.total} notificação${data.total !== 1 ? 'ões' : ''} disparada${data.total !== 1 ? 's' : ''}`)
                      } else {
                        setPushMsg('Nenhuma notificação pendente agora.')
                      }
                      setTimeout(() => setPushMsg(''), 4000)
                    }} className="text-[11px] text-[#0099CC] border border-[#0099CC]/20 bg-[#E6F4FA] hover:bg-[#d0ebf7] px-3 py-1.5 rounded-lg transition-colors">
                      Verificar agora
                    </button>
                  </div>

                  {autoNotifyLog.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Histórico automático</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {autoNotifyLog.map((log, i) => <p key={i} className="text-[11px] text-gray-500 font-mono">{log}</p>)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200"/>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">ou envie manualmente</span>
                  <div className="flex-1 h-px bg-gray-200"/>
                </div>

                {/* Envio manual */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-[14px] font-semibold text-gray-800 mb-1">Enviar notificação manual</h2>
                  <p className="text-[12px] text-gray-400 mb-4">Para todos que ativaram as notificações no app</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Título</label>
                      <input type="text" placeholder="Ex: Jogo em 1 hora!" value={pushTitle} onChange={e => setPushTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC]"/>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Mensagem</label>
                      <textarea placeholder="Ex: Brasil × Argentina começa às 16h. Último aviso para palpites!" value={pushBody} onChange={e => setPushBody(e.target.value)} rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC] resize-none"/>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Modelos rápidos</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Jogo em breve',       title: 'Bolão Copa 2026 BEL',  body: 'Último aviso! Faça seu palpite antes do fechamento.' },
                          { label: 'Ranking atualizado',  title: 'Bolão Copa 2026 BEL',  body: 'Ranking atualizado! Confira sua posição após os últimos resultados.' },
                          { label: 'Jogos amanhã',        title: 'Bolão Copa 2026 BEL',  body: 'Jogos amanhã! Faça seus palpites antes do fechamento.' },
                        ].map(t => (
                          <button key={t.label} onClick={() => { setPushTitle(t.title); setPushBody(t.body) }}
                            className="text-[11px] text-gray-600 border border-gray-200 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors">
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={sendPush} disabled={pushSending || !pushTitle || !pushBody}
                      className="w-full py-3.5 rounded-xl bg-[#0099CC] text-white font-bold text-[14px] hover:bg-[#007aa8] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                      {pushSending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Ico.Bell />}
                      {pushSending ? 'Enviando...' : 'Enviar para todos'}
                    </button>
                    {pushMsg && <p className="text-[12px] text-green-600 text-center font-medium">{pushMsg}</p>}
                  </div>
                </div>

                <div className="bg-[#E6F4FA] border border-[#0099CC]/20 rounded-xl p-4">
                  <p className="text-[12px] font-semibold text-[#0099CC] mb-2">Como os colaboradores ativam</p>
                  <div className="space-y-1.5">
                    {['No app, clique no ícone de sino no topo da tela', 'Autorize quando o navegador perguntar', 'Notificações chegam mesmo com o app fechado (Android/Chrome)', 'No iOS é necessário ter o app instalado na tela inicial'].map((s, i) => (
                      <p key={i} className="text-[12px] text-[#0064a8] flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#0099CC]/20 text-[#0099CC] text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                        {s}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── VERSÃO / CHANGELOG ── */}
            {page === 'versao' && (
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Current version banner */}
                <div className="bg-gradient-to-br from-[#0099CC] to-[#006a99] rounded-2xl p-6 text-center text-white shadow-lg">
                  <p className="text-[12px] font-medium text-white/70 uppercase tracking-wide mb-1">Versão atual</p>
                  <p className="text-[42px] font-black leading-none">v1.17.2</p>
                  <p className="text-[12px] text-white/70 mt-2">Bolão Copa 2026 BEL</p>
                </div>

                {/* Copy text card */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-[13px] font-bold text-gray-800">Texto para o grupo</p>
                    <button
                      onClick={() => {
                        const txt = document.getElementById('changelog-text')?.innerText || ''
                        navigator.clipboard.writeText(txt)
                        setVersaoCopied(true)
                        setTimeout(() => setVersaoCopied(false), 2000)
                      }}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC] bg-[#0099CC]/10 hover:bg-[#0099CC]/20 px-3 py-1.5 rounded-lg transition-colors">
                      {versaoCopied ? (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado!</>
                      ) : (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar texto</>
                      )}
                    </button>
                  </div>
                  <div id="changelog-text" className="px-5 py-4 text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">
{`Bolão Copa 2026 BEL — Atualização v1.17.2

🔔 Resolvido de vez o aviso que piscava
Era o banner azul de "ative as notificações" no topo da tela, não o popup de atualização — ele calculava o estado errado a cada troca de aba. Agora calcula certo desde o primeiro instante, e não pisca mais.

⚽ Notificação de gol em tempo real
A cada gol, você recebe um aviso na hora com o placar, o seu palpite naquele jogo e quantos pontos você está fazendo se terminar assim.

⏱️ Sync mais rápido durante o jogo
Os placares agora atualizam a cada 1 minuto enquanto tem jogo ao vivo (era 5 minutos).

📋 Resumo das novidades direto no aviso de atualização
Quando aparece "Nova versão disponível", o próprio aviso já mostra o resumo do que mudou.

Atualizem o app para a versão mais recente! 🏆`}
                  </div>
                </div>

                {/* History */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-[13px] font-bold text-gray-800">Histórico de versões</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {[
                      { v: 'v1.17.2', desc: 'Corrigido de vez o banner de notificação que piscava ao trocar de aba (calculava o estado errado a cada remontagem). Notificação de gol com palpite e pontos em tempo real. Sync ao vivo de 5min para 1min. Popup de atualização agora mostra o resumo das novidades e um aviso reforçado pra ativar notificações.' },
                      { v: 'v1.17', desc: 'Correção do popup de atualização (parava de piscar ao trocar de aba — lógica movida pro _app.tsx). Card pulsa em vermelho quando o palpite não foi confirmado. Selo de grupo + colocação nos cards de jogo, com modal de classificação. Menu inferior transparente no mobile.' },
                      { v: 'v1.16', desc: 'Palpite automático 0×0 (50% dos pontos) para quem esquece de palpitar. Classificação dos grupos e chaveamento mata-mata na tela Campeão.' },
                      { v: 'v1.15', desc: 'Palpites ilimitados. Popup de estatísticas em todas as bandeiras. Pódio na lista de apostadores. Filtro de online no ranking. Aba Assistir com player CazéTV, chat ao vivo e rank dos participantes.' },
                      { v: 'v1.13', desc: 'KPIs admin, novas notificações push, Meu Desempenho, Destaques do Feed, Estatísticas do bolão, online no ranking.' },
                      { v: 'v1.12', desc: 'Jornada Em Breve → Ao Vivo → Encerrados nos palpites. Botão 3D de colocação no ranking com scroll automático.' },
                      { v: 'v1.11', desc: 'Pontuação colorida (10pts/7pts/5pts/2pts) e data da última atualização no ranking.' },
                      { v: 'v1.10', desc: 'Aba Palpites abre no "Ao Vivo" durante jogos. Sincronização inteligente baseada no cronograma.' },
                      { v: 'v1.9',  desc: 'Correção do bug da barra inferior no iOS e tela de atualização.' },
                      { v: 'v1.8',  desc: 'Número de versão no topo. Card de palpites do grupo. Placar ao vivo com pontuação em tempo real.' },
                    ].map(item => (
                      <div key={item.v} className="px-5 py-3 flex gap-3">
                        <span className="text-[12px] font-bold text-[#0099CC] flex-shrink-0 w-12">{item.v}</span>
                        <span className="text-[12px] text-gray-500 leading-snug">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </main>

          {/* ── MOBILE BOTTOM NAV — md:hidden ────────────── */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#001e3c] border-t border-white/10 z-30 flex" style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
            {NAV.map(({ id, label, Icon, badge }) => (
              <button key={id}
                onClick={() => { setPage(id); if (id === 'logs') loadPaymentLogs() }}
                className={`flex-1 flex flex-col items-center justify-center py-4 gap-1.5 transition-colors relative ${page === id ? 'text-[#4dc6ef]' : 'text-white/40'}`}>
                {page === id && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-[#0099CC] rounded-full"/>
                )}
                <div className="relative scale-125">
                  <Icon />
                  {badge !== null && (
                    <span className={`absolute -top-1.5 -right-2 text-[8px] font-bold px-1 py-0.5 rounded-full leading-none ${id === 'matches' ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'}`}>
                      {badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold leading-none">
                  {label === 'Dashboard' ? 'Início' :
                   label === 'Participantes' ? 'Pessoas' :
                   label === 'Partidas' ? 'Jogos' :
                   label === 'PIX' ? 'PIX' :
                   label === 'Pagamentos' ? 'Pagtos' : 'Avisos'}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Reset password modal */}
      {resetPassPlayer && (() => {
        const name = resetPassPlayer.nickname || resetPassPlayer.username
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.5)'}}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h3 className="text-[16px] font-bold text-gray-900 text-center mb-1">Resetar senha</h3>
              <p className="text-[13px] text-gray-500 text-center mb-5">
                Defina uma nova senha para <strong>{name}</strong>.<br/>
                <span className="text-[11px] text-gray-400">Informe a senha temporária para o colaborador e peça para ele trocar depois.</span>
              </p>
              <input
                type="text"
                placeholder="Nova senha (mín. 4 caracteres)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC] mb-3"
                autoFocus
              />
              {passMsg && (
                <p className={`text-[12px] text-center mb-3 font-medium ${passMsg.includes('sucesso') ? 'text-green-600' : 'text-red-500'}`}>{passMsg}</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setResetPassPlayer(null); setNewPassword(''); setPassMsg('') }}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-[14px] font-semibold hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={resetPlayerPassword} disabled={savingPass || newPassword.length < 4}
                  className="flex-1 py-3 rounded-xl bg-[#0099CC] text-white text-[14px] font-semibold hover:bg-[#007aa8] disabled:opacity-50 transition-colors">
                  {savingPass ? 'Salvando...' : 'Salvar senha'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Confirm reminder modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.5)'}}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <h3 className="text-[16px] font-bold text-gray-900 text-center mb-1">Enviar lembrete?</h3>
            <p className="text-[13px] text-gray-500 text-center mb-5">
              Notificar <strong>{noPicksCount} participante{noPicksCount !== 1 ? 's' : ''}</strong> que ainda não palpitaram.
            </p>
            {reminderResult ? (
              <p className="text-[13px] text-center text-green-600 font-semibold py-3">{reminderResult}</p>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setShowReminderModal(false)} disabled={sendingReminder}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-[14px] font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">Cancelar</button>
                <button onClick={sendReminder} disabled={sendingReminder}
                  className="flex-1 py-3 rounded-xl bg-[#0099CC] text-white text-[14px] font-semibold hover:bg-[#007aa3] transition-colors disabled:opacity-50">
                  {sendingReminder ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (() => {
        const p = players.find(pl => pl.id === confirmDelete)
        if (!p) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.5)'}}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Ico.Trash />
              </div>
              <h3 className="text-[16px] font-bold text-gray-900 text-center mb-1">Excluir participante?</h3>
              <p className="text-[13px] text-gray-500 text-center mb-1"><strong>{p.nickname || p.username}</strong> (@{p.username})</p>
              <p className="text-[12px] text-red-500 text-center mb-5">Todos os palpites serão apagados permanentemente.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-[14px] font-semibold hover:bg-gray-50 transition-colors">Cancelar</button>
                <button onClick={() => deletePlayer(p.id)} className="flex-1 py-3 rounded-xl bg-red-500 text-white text-[14px] font-semibold hover:bg-red-600 transition-colors">Excluir</button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
