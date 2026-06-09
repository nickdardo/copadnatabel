import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Player, FASE_ORDER, getPresence } from '@/lib/supabase'
import Head from 'next/head'
import { formatPixKeyDisplay, getKeyTypeLabel, PixKeyType } from '@/lib/pix'

type Tab = 'matches' | 'players' | 'pix' | 'logs'
type SyncResult = { ok: boolean; synced: number; updated: number; recalculated: boolean; quotaRemaining: number | null; error?: string }

// BRT formatter
function fmtBRT(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

export default function AdminPage() {
  const { player, loading, isAdmin, logout } = useAuth()
  const router = useRouter()
  const [matches,       setMatches]       = useState<Match[]>([])
  const [players,       setPlayers]       = useState<Player[]>([])
  const [fetching,      setFetching]      = useState(true)
  const [tab,           setTab]           = useState<Tab>('matches')
  const [activePhase,   setActivePhase]   = useState('Fase de Grupos')
  const [syncing,       setSyncing]       = useState(false)
  const [syncResult,    setSyncResult]    = useState<SyncResult | null>(null)
  const [recalcing,     setRecalcing]     = useState(false)
  const [recalcMsg,     setRecalcMsg]     = useState('')
  const [editId,        setEditId]        = useState<string | null>(null)
  const [resH,          setResH]          = useState('')
  const [resA,          setResA]          = useState('')
  const [saving,        setSaving]        = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [togglingId,    setTogglingId]    = useState<string | null>(null)
  const [lastAutoSync,  setLastAutoSync]  = useState<string>('')
  const [autoSyncing,   setAutoSyncing]   = useState(false)
  const [refreshing,    setRefreshing]    = useState(false)
  const [pixCpf,        setPixCpf]        = useState('')
  const [pixKeyType,    setPixKeyType]    = useState<PixKeyType>('cpf')
  const [pixNome,       setPixNome]       = useState('')
  const [pixValor,      setPixValor]      = useState('10')
  const [pixDesc,       setPixDesc]       = useState('Bolão Copa 2026 BEL')
  const [pixWhatsApp,   setPixWhatsApp]   = useState('')
  const [pixGroupLink,  setPixGroupLink]  = useState('')
  const [savingPix,     setSavingPix]     = useState(false)
  const [pixSaved,      setPixSaved]      = useState(false)
  const [pixLoaded,     setPixLoaded]     = useState(false)
  const [extraAmount,   setExtraAmount]   = useState('')
  const [extraNote,     setExtraNote]     = useState('')
  const [savingExtra,   setSavingExtra]   = useState(false)
  const [extraSaved,    setExtraSaved]    = useState(false)
  const [currentExtra,  setCurrentExtra]  = useState(0)
  const [playerSearch,  setPlayerSearch]  = useState('')
  const [picksCount,    setPicksCount]    = useState<Record<string, number>>({})
  const [presenceTick,  setPresenceTick]  = useState(0)
  const [paymentLogs,   setPaymentLogs]   = useState<{id:string;player_name:string;action:string;confirmed_by:string;valor:number;created_at:string}[]>([])
  const [calcingBadges, setCalcingBadges] = useState(false)
  const [badgesMsg,     setBadgesMsg]     = useState('')

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
    // Load PIX config
    const { data: pixRows } = await supabase.from('pix_config').select('*').limit(1)
    if (pixRows && pixRows[0]) {
      setPixCpf(pixRows[0].cpf || '')
      setPixKeyType((pixRows[0].key_type as PixKeyType) || 'cpf')
      setPixNome(pixRows[0].nome || '')
      setPixValor(String(pixRows[0].valor || 10))
      setPixDesc(pixRows[0].descricao || 'Bolão Copa 2026 BEL')
      setPixWhatsApp(pixRows[0].whatsapp || '')
      setPixGroupLink(pixRows[0].group_link || '')
    }
    setPixLoaded(true)
    // Load extra prize amount
    const { data: prizeRows } = await supabase.from('prize_config').select('extra_amount').limit(1)
    if (prizeRows && prizeRows[0]) setCurrentExtra(Number(prizeRows[0].extra_amount) || 0)
    // Load picks count per player from scores table
    const { data: scoresData } = await supabase.from('scores').select('player_id, picks_count')
    if (scoresData) {
      const map: Record<string, number> = {}
      scoresData.forEach((s: { player_id: string; picks_count: number }) => {
        map[s.player_id] = s.picks_count || 0
      })
      setPicksCount(map)
    }
    setFetching(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Refresh presence dots every 30s without full reload
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

  // Auto-sync every 2 hours (client-side, works on Hobby plan)
  useEffect(() => {
    async function autoSync() {
      setAutoSyncing(true)
      try {
        const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'manual' }) })
        const data = await res.json()
        if (data.ok) {
          setLastAutoSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
          await fetchAll()
        }
      } catch {}
      setAutoSyncing(false)
    }
    // Sync on mount
    autoSync()
    // Then every 2 hours
    const interval = setInterval(autoSync, 2 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function refreshAll() {
    setRefreshing(true)
    await fetchAll()
    if (tab === 'logs') await loadPaymentLogs()
    setRefreshing(false)
  }

  async function loadPaymentLogs() {
    const res = await fetch('/api/admin/payment-log')
    const { data } = await res.json()
    setPaymentLogs(data || [])
  }

  async function calcBadges() {
    setCalcingBadges(true)
    const res = await fetch('/api/admin/badges', { method: 'POST' })
    const { granted } = await res.json()
    setBadgesMsg(`${granted} conquista${granted !== 1 ? 's' : ''} atribuida${granted !== 1 ? 's' : ''}!`)
    setTimeout(() => setBadgesMsg(''), 4000)
    setCalcingBadges(false)
  }

  async function triggerSync() {
    setSyncing(true); setSyncResult(null)
    try {
      const res  = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'manual' }) })
      const data = await res.json()
      setSyncResult(data)
      if (data.ok) fetchAll()
    } catch { setSyncResult({ ok: false, synced: 0, updated: 0, recalculated: false, quotaRemaining: null, error: 'Erro de rede' }) }
    setSyncing(false)
  }

  async function recalcScores() {
    setRecalcing(true)
    const { error } = await supabase.rpc('recalc_all_scores')
    setRecalcMsg(error ? 'Erro ao recalcular.' : 'Pontuações recalculadas!')
    setTimeout(() => setRecalcMsg(''), 3000)
    setRecalcing(false)
  }

  async function saveExtra() {
    const val = parseFloat(String(extraAmount).replace(',', '.'))
    if (isNaN(val) || val < 0) return
    setSavingExtra(true)
    const newTotal = currentExtra + val
    // Try update first, then insert if no rows
    const { data: rows } = await supabase.from('prize_config').select('id').limit(1)
    if (rows && rows.length > 0) {
      await supabase.from('prize_config').update({
        extra_amount: newTotal,
        extra_note: extraNote || null,
        updated_at: new Date().toISOString(),
      }).eq('id', rows[0].id)
    } else {
      await supabase.from('prize_config').insert({
        pct_first: 60, pct_second: 25, pct_third: 15,
        extra_amount: newTotal, extra_note: extraNote || null,
      })
    }
    setCurrentExtra(newTotal)
    setExtraAmount('')
    setExtraNote('')
    setSavingExtra(false)
    setExtraSaved(true)
    setTimeout(() => setExtraSaved(false), 2500)
  }

  async function resetExtra() {
    const { data: resetRows } = await supabase.from('prize_config').select('id').limit(1)
    if (resetRows && resetRows.length > 0) {
      await supabase.from('prize_config').update({ extra_amount: 0, extra_note: null }).eq('id', resetRows[0].id)
    }
    setCurrentExtra(0)
  }

  async function savePix() {
    if (!pixCpf || !pixNome) return
    setSavingPix(true)
    const valor = parseFloat(pixValor) || 10
    // Format key based on type
    let key = pixCpf.trim()
    if (pixKeyType === 'cpf') key = key.replace(/\D/g, '')
    if (pixKeyType === 'telefone') { const d = key.replace(/\D/g,''); key = d.startsWith('55') ? '+'+d : '+55'+d }
    const { data: existing } = await supabase.from('pix_config').select('id').limit(1)
    if (existing && existing[0]) {
      await supabase.from('pix_config').update({
        cpf: key, key_type: pixKeyType, nome: pixNome, valor, descricao: pixDesc, whatsapp: pixWhatsApp || null, group_link: pixGroupLink || null, updated_at: new Date().toISOString()
      }).eq('id', existing[0].id)
    } else {
      await supabase.from('pix_config').insert({ cpf: key, key_type: pixKeyType, nome: pixNome, valor, descricao: pixDesc, whatsapp: pixWhatsApp || null, group_link: pixGroupLink || null })
    }
    setSavingPix(false); setPixSaved(true)
    setTimeout(() => setPixSaved(false), 3000)
  }

  async function saveResult(match: Match) {
    if (resH === '' || resA === '') return
    setSaving(true)
    await supabase.from('matches').update({ score_home: Number(resH), score_away: Number(resA), status: 'done' }).eq('id', match.id)
    setSaving(false); setEditId(null)
    fetchAll(); recalcScores()
  }

  async function togglePayment(p: Player) {
    setTogglingId(p.id)
    const nowPaid = !p.payment_ok
    const { error } = await supabase.from('players').update({ payment_ok: nowPaid }).eq('id', p.id)
    if (!error) {
      await fetchAll()
      // Log the action
      const name = p.nickname || p.username
      await fetch('/api/admin/payment-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: p.id,
          player_name: name,
          action: nowPaid ? 'confirmed' : 'reversed',
          confirmed_by: player?.username,
          valor: parseFloat(pixValor) || 10,
        }),
      })
      // Feed event only when confirming
      if (nowPaid) {
        await fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'payment_confirmed', player_id: p.id, player_name: name }),
        })
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
    setConfirmDelete(null)
    fetchAll()
  }

  async function setMatchStatus(match: Match, status: 'live' | 'upcoming') {
    await supabase.from('matches').update({
      status,
      ...(status === 'upcoming' ? { score_home: null, score_away: null } : {})
    }).eq('id', match.id)
    fetchAll()
  }

  const nonAdminPlayers    = players.filter(p => !p.is_admin)
  const filteredPlayers    = nonAdminPlayers.filter(p => {
    if (!playerSearch) return true
    const q = playerSearch.toLowerCase()
    return (p.nickname || '').toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
  })
  const onlineCount        = nonAdminPlayers.filter(p => getPresence(p.last_seen_at).status === 'online').length
  const paidCount          = nonAdminPlayers.filter(p => p.payment_ok && !p.is_admin).length
  const prizePool          = paidCount * 10 + currentExtra
  const phases          = FASE_ORDER.filter(f => matches.some(m => m.fase === f))
  const filteredMatches = matches.filter(m => m.fase === activePhase)
  const liveCount       = matches.filter(m => m.status === 'live').length
  const doneCount       = matches.filter(m => m.status === 'done').length

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
      </Head>

      <div className="min-h-screen bg-gray-50 pb-6">
        {/* Header */}
        <header className="bg-[#001e3c] sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/copa2026-logo.jpg" alt="Copa 2026" className="h-9 w-auto rounded-lg object-contain" />
              <div className="h-4 w-px bg-white/20" />
              <span className="text-[13px] text-white/70 font-medium">Painel Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-white/50">@{player?.username}</span>
              <button onClick={() => router.push('/ranking')} className="text-[12px] text-white/60 hover:text-white border border-white/20 px-3 py-1.5 rounded-lg transition-colors">Ver app</button>
              <button onClick={() => { logout(); router.push('/') }} className="text-[12px] text-white/60 hover:text-white transition-colors">Sair</button>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Participantes', value: nonAdminPlayers.length,             icon: '👥', color: 'text-blue-600'  },
              { label: 'Online agora',  value: onlineCount,                        icon: '🟢', color: 'text-green-600' },
              { label: 'Prêmio total',  value: `R$${prizePool}`,                   icon: '🏆', color: 'text-amber-600' },
              { label: 'Jogos',         value: `${doneCount}/${matches.length}`,   icon: '⚽', color: 'text-gray-600'  },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className={`text-[16px] font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Sync + Recalc */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 text-[14px] mb-0.5">Sincronizar API</p>
              <p className="text-[11px] text-gray-400 mb-3">The Odds API · jogos + placares</p>
              <button onClick={triggerSync} disabled={syncing}
                className="w-full py-2.5 rounded-xl bg-[#0099CC] text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[#007aa8] disabled:opacity-50 transition-colors">
                {syncing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sincronizar agora'}
              </button>
              {syncResult && (
                <p className={`text-[11px] mt-2 ${syncResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                  {syncResult.ok ? `✓ +${syncResult.synced} novos · ${syncResult.updated} atualizados` : `✗ ${syncResult.error}`}
                </p>
              )}
              {lastAutoSync && (
                <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                  {autoSyncing ? <span className="w-2 h-2 rounded-full bg-[#0099CC] animate-pulse inline-block"/> : '✓'}
                  Auto-sync {autoSyncing ? 'em andamento...' : `último: ${lastAutoSync}`}
                </p>
              )}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 text-[14px] mb-0.5">Recalcular</p>
              <p className="text-[11px] text-gray-400 mb-3">Pontuacoes e ranking</p>
              <button onClick={recalcScores} disabled={recalcing}
                className="w-full py-2.5 rounded-xl bg-gray-800 text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-gray-900 disabled:opacity-50 transition-colors mb-2">
                {recalcing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Recalcular ranking'}
              </button>
              <button onClick={calcBadges} disabled={calcingBadges}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {calcingBadges ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Calcular conquistas'}
              </button>
              {recalcMsg && <p className="text-[11px] mt-2 text-green-600">{recalcMsg}</p>}
              {badgesMsg && <p className="text-[11px] mt-1 text-amber-600">{badgesMsg}</p>}
            </div>
          </div>

          {/* Tabs + Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex flex-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
            {([['matches', `Partidas (${matches.length})`], ['players', `Participantes (${nonAdminPlayers.length})`], ['pix', 'PIX'], ['logs', 'Pagamentos']] as [Tab, string][]).map(([t, label]) => (
                <button key={t} onClick={() => { setTab(t); if (t === 'logs') loadPaymentLogs() }}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${tab === t ? 'bg-white text-[#0099CC] shadow-sm' : 'text-gray-400'}`}>
                  {label}
                </button>
              ))}
            </div>
            {/* Refresh button */}
            <button onClick={refreshAll} disabled={refreshing}
              title="Atualizar lista"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round"
                className={refreshing ? 'animate-spin' : ''}>
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>

          {/* PARTIDAS */}
          {tab === 'matches' && (
            <>
              <div className="flex gap-2">
                {[
                  { label: 'Ao vivo',   count: liveCount,                              color: 'bg-red-50 border-red-200 text-red-700'   },
                  { label: 'Encerrados',count: doneCount,                              color: 'bg-gray-50 border-gray-200 text-gray-600' },
                  { label: 'Em breve',  count: matches.length - liveCount - doneCount, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                ].map(s => (
                  <div key={s.label} className={`flex-1 text-center py-2 rounded-xl border text-[12px] font-semibold ${s.color}`}>
                    {s.count} {s.label}
                  </div>
                ))}
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                {phases.map(f => (
                  <button key={f} onClick={() => setActivePhase(f)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${activePhase === f ? 'bg-[#0099CC] text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
                    {f === 'Fase de Grupos' ? 'Grupos' : f} ({matches.filter(m => m.fase === f).length})
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredMatches.map(m => (
                  <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        {m.status === 'live'     && <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>Ao vivo</span>}
                        {m.status === 'done'     && <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">Encerrado</span>}
                        {m.status === 'upcoming' && <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">Em breve</span>}
                        {/* BRT time */}
                        {m.match_date && <span className="text-[11px] text-gray-400">{fmtBRT(m.match_date)}</span>}
                        {m.group_name && <span className="text-[11px] text-gray-400">· {m.group_name}</span>}
                      </div>
                      <div className="flex gap-1">
                        {m.status !== 'live'     && <button onClick={() => setMatchStatus(m, 'live')}     className="text-[11px] text-red-600 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Ao vivo</button>}
                        {m.status !== 'upcoming' && <button onClick={() => setMatchStatus(m, 'upcoming')} className="text-[11px] border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">Reset</button>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-gray-800 flex items-center gap-1.5">{m.home_flag} {m.home_team}</span>
                      {editId === m.id ? (
                        <div className="flex items-center gap-1.5">
                          <input type="number" min="0" max="20" value={resH} onChange={e => setResH(e.target.value)}
                            className="w-11 h-10 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900"/>
                          <span className="text-gray-400">×</span>
                          <input type="number" min="0" max="20" value={resA} onChange={e => setResA(e.target.value)}
                            className="w-11 h-10 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900"/>
                          <button onClick={() => saveResult(m)} disabled={saving} className="text-[11px] bg-[#0099CC] text-white px-3 py-2 rounded-xl hover:bg-[#007aa8] disabled:opacity-50">
                            {saving ? '...' : 'OK'}
                          </button>
                          <button onClick={() => setEditId(null)} className="text-[11px] border border-gray-200 px-2 py-2 rounded-xl hover:bg-gray-50">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {(m.status === 'done' || m.status === 'live') && m.score_home != null
                            ? <span className={`text-[16px] font-bold ${m.status === 'live' ? 'text-red-600' : 'text-gray-800'}`}>{m.score_home} × {m.score_away}</span>
                            : <span className="text-gray-300 font-medium">vs</span>}
                          <button onClick={() => { setEditId(m.id); setResH(m.score_home != null ? String(m.score_home) : ''); setResA(m.score_away != null ? String(m.score_away) : '') }}
                            className="text-[11px] border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Editar</button>
                        </div>
                      )}
                      <span className="text-[13px] font-semibold text-gray-800 flex items-center gap-1.5">{m.away_team} {m.away_flag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* PIX */}
          {tab === 'pix' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="font-bold text-gray-900 text-[15px] mb-1">Configurar chave PIX</p>
                <p className="text-[12px] text-gray-400 mb-4">Os participantes verão o QR Code para pagar a inscrição</p>
                <div className="space-y-3">
                  {/* Key type selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Tipo de chave PIX</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['cpf','telefone','email','aleatoria'] as PixKeyType[]).map(type => (
                        <button key={type} type="button"
                          onClick={() => { setPixKeyType(type); setPixCpf('') }}
                          className={`py-2.5 rounded-xl text-[13px] font-semibold border transition-all ${
                            pixKeyType === type
                              ? 'bg-[#0099CC] text-white border-[#0099CC]'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-[#0099CC]/40'
                          }`}>
                          {type === 'cpf' ? '🪪 CPF' : type === 'telefone' ? '📱 Telefone' : type === 'email' ? '📧 E-mail' : '🔑 Aleatória'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Key input */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Chave PIX ({pixKeyType === 'cpf' ? 'CPF' : pixKeyType === 'telefone' ? 'Telefone' : pixKeyType === 'email' ? 'E-mail' : 'Chave aleatória'})
                    </label>
                    <input
                      type={pixKeyType === 'email' ? 'email' : 'text'}
                      placeholder={pixKeyType === 'cpf' ? '000.000.000-00' : pixKeyType === 'telefone' ? '(11) 99999-9999' : pixKeyType === 'email' ? 'exemplo@email.com' : 'Cole a chave aleatória aqui'}
                      value={pixCpf}
                      onChange={e => setPixCpf(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC] font-mono"/>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Nome do beneficiário</label>
                    <input type="text" placeholder="Nome completo" value={pixNome}
                      onChange={e => setPixNome(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC]"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Valor (R$)</label>
                      <input type="number" min="1" step="0.01" value={pixValor}
                        onChange={e => setPixValor(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC]"/>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Descrição</label>
                      <input type="text" value={pixDesc}
                        onChange={e => setPixDesc(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC]"/>
                    </div>
                  </div>
                  {/* WhatsApp suporte */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      WhatsApp de suporte (opcional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px]">📱</span>
                      <input type="tel" placeholder="(11) 99999-9999"
                        value={pixWhatsApp}
                        onChange={e => setPixWhatsApp(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC]"/>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Número que aparecerá no botão "Suporte" nas regras</p>
                  </div>

                  {/* Link do grupo WhatsApp */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Link do grupo WhatsApp (opcional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px]">👥</span>
                      <input type="url" placeholder="https://chat.whatsapp.com/..."
                        value={pixGroupLink}
                        onChange={e => setPixGroupLink(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:border-[#0099CC] font-mono text-[12px]"/>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Aparecerá como botão "Entrar no grupo" nas regras e no app</p>
                  </div>

                  {/* Push notification broadcast */}
                  <div className="bg-[#E6F4FA] border border-[#0099CC]/20 rounded-xl p-4">
                    <p className="text-[12px] font-bold text-[#0099CC] mb-0.5">Notificacao push</p>
                    <p className="text-[11px] text-gray-500 mb-3">Envia para todos que ativaram as notificacoes no app</p>
                    <div className="space-y-2">
                      <input type="text" placeholder="Titulo — ex: Jogo em 1 hora!" id="push-title"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-[13px] focus:outline-none focus:border-[#0099CC]"/>
                      <input type="text" placeholder="Mensagem — ex: Brasil x Argentina começa às 16h" id="push-body"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-[13px] focus:outline-none focus:border-[#0099CC]"/>
                      <button
                        onClick={async () => {
                          const title = (document.getElementById('push-title') as HTMLInputElement)?.value
                          const body  = (document.getElementById('push-body')  as HTMLInputElement)?.value
                          if (!title || !body) return
                          const res = await fetch('/api/push/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title, body }),
                          })
                          const d = await res.json()
                          alert(`Notificacao enviada para ${d.sent} dispositivo${d.sent !== 1 ? 's' : ''}.`)
                        }}
                        className="w-full py-2.5 rounded-xl bg-[#0099CC] text-white text-[13px] font-semibold hover:bg-[#007aa8] transition-colors">
                        Enviar para todos
                      </button>
                    </div>
                  </div>

                  <button onClick={savePix} disabled={savingPix || !pixCpf || !pixNome}
                    className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                      pixSaved ? 'bg-green-500 text-white' : 'bg-[#0099CC] text-white hover:bg-[#007aa8] disabled:opacity-50'}`}>
                    {savingPix ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> :
                     pixSaved ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Salvo!</> :
                     'Salvar configuração PIX'}
                  </button>
                </div>
              </div>

              {pixCpf && pixNome && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="text-[13px] font-bold text-green-800 mb-1">✓ PIX configurado</p>
                  <p className="text-[12px] text-green-700">Os participantes já podem acessar <strong>/pagar</strong> para ver o QR Code e efetuar o pagamento.</p>
                  <p className="text-[12px] text-green-600 mt-2">
                    Tipo: <strong>{pixKeyType === 'cpf' ? 'CPF' : pixKeyType === 'telefone' ? 'Telefone' : pixKeyType === 'email' ? 'E-mail' : 'Chave aleatória'}</strong>
                    {' · '}Chave: {pixCpf} · Beneficiário: {pixNome}
                  </p>
                  {pixWhatsApp && (
                    <p className="text-[12px] text-green-600 mt-1">
                      📱 Suporte WhatsApp: {pixWhatsApp}
                    </p>
                  )}
                  {pixGroupLink && (
                    <p className="text-[12px] text-green-600 mt-1">
                      👥 Grupo: <a href={pixGroupLink} target="_blank" rel="noopener noreferrer" className="underline truncate">{pixGroupLink.slice(0, 40)}{pixGroupLink.length > 40 ? '...' : ''}</a>
                    </p>
                  )}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-[12px] font-bold text-amber-800 mb-2">Fluxo de pagamento</p>
                <div className="space-y-1.5">
                  {['Admin cadastra CPF e nome aqui','Participante acessa /pagar e escaneia o QR Code','Participante paga e avisa ao admin','Admin confirma em Participantes → botão Confirmar pagto'].map((s,i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-amber-700">
                      <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PARTICIPANTES */}
          {tab === 'players' && (
            <>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-gray-900 text-[14px]">Resumo de pagamentos</p>
                  <span className="text-[13px] font-bold text-[#0099CC]">R$ {prizePool},00 arrecadados</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0099CC] rounded-full transition-all"
                    style={{ width: nonAdminPlayers.length > 0 ? `${Math.round((paidCount/nonAdminPlayers.length)*100)}%` : '0%' }}/>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">{paidCount} de {nonAdminPlayers.length} confirmados</p>
              </div>

              {/* Extra prize card */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-[14px]">Adicionar valor extra</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Atual: <strong>R$ {currentExtra.toFixed(2).replace('.',',')}</strong> em bônus
                    </p>
                  </div>
                  {currentExtra > 0 && (
                    <button onClick={resetExtra} className="text-[11px] text-red-400 hover:text-red-600 border border-red-200 px-2 py-1 rounded-lg transition-colors">
                      Zerar bônus
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px] font-medium">R$</span>
                      <input
                        type="number" min="0" step="0.01"
                        placeholder="0,00"
                        value={extraAmount}
                        onChange={e => setExtraAmount(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all"
                      />
                    </div>
                    <button
                      onClick={saveExtra}
                      disabled={savingExtra || !extraAmount}
                      className="px-4 py-2.5 rounded-xl bg-[#0099CC] text-white text-[13px] font-semibold hover:bg-[#007aa8] disabled:opacity-50 transition-colors whitespace-nowrap">
                      {savingExtra ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/> : extraSaved ? '✓ Adicionado!' : 'Adicionar'}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Observação (opcional) — ex: Patrocínio empresa"
                    value={extraNote}
                    onChange={e => setExtraNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                  />
                </div>
                {currentExtra > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-gray-500">Prêmio total com bônus:</span>
                      <span className="font-bold text-[#0099CC]">R$ {prizePool.toFixed(2).replace('.',',')}</span>
                    </div>
                    <div className="flex gap-3 mt-1.5 text-[11px] text-gray-400">
                      <span>🥇 R$ {(prizePool * 0.6).toFixed(2).replace('.',',')}</span>
                      <span>🥈 R$ {(prizePool * 0.25).toFixed(2).replace('.',',')}</span>
                      <span>🥉 R$ {(prizePool * 0.15).toFixed(2).replace('.',',')}</span>
                    </div>
                  </div>
                )}
              </div>

              {!pixCpf && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-[12px] text-amber-700">Configure o PIX na aba <strong>PIX</strong> para que os participantes possam pagar.</p>
                </div>
              )}

              {/* Search + legend */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    placeholder="Buscar por nome ou usuário..."
                    value={playerSearch}
                    onChange={e => setPlayerSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-[13px] focus:outline-none focus:border-[#0099CC] transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 whitespace-nowrap bg-white border border-gray-100 rounded-xl px-3 py-2">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Online</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Recente</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block"/>Off</span>
                  {/* presenceTick forces re-render every 30s */}
                  <span className="sr-only">{presenceTick}</span>
                </div>
              </div>

              <div className="space-y-2">
                {filteredPlayers.map(p => {
                  const av = p.avatar_url
                    ? (p.avatar_url.startsWith('http') ? p.avatar_url : supabase.storage.from('avatars').getPublicUrl(p.avatar_url).data.publicUrl)
                    : null
                  const name = p.nickname || p.username
                  const presence = getPresence(p.last_seen_at)
                  const picks = picksCount[p.id] || 0
                  return (
                    <div key={p.id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-sm">
                      <div className="flex items-center gap-3">
                        {/* Avatar with presence dot */}
                        <div className="relative flex-shrink-0">
                          {av
                            ? <img src={av} alt={name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"/>
                            : <div className="w-10 h-10 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[11px] font-bold text-[#0099CC]">
                                {(name||'?').split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()}
                              </div>
                          }
                          {/* Presence dot */}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            presence.status === 'online'  ? 'bg-green-500' :
                            presence.status === 'recent'  ? 'bg-amber-400' : 'bg-gray-300'
                          }`}/>
                        </div>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-gray-900 text-[14px] truncate">{name}</p>
                            {presence.status === 'online' && (
                              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">ONLINE</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[11px] text-gray-400">@{p.username}</p>
                            <span className="text-gray-200">·</span>
                            <p className="text-[11px] text-gray-400">{picks} palpites</p>
                            <span className="text-gray-200">·</span>
                            <p className={`text-[11px] ${
                              presence.status === 'online' ? 'text-green-600' :
                              presence.status === 'recent' ? 'text-amber-500' : 'text-gray-400'
                            }`}>{presence.label}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* WhatsApp — only shown if number registered in pix_config whatsapp field */}
                          {pixWhatsApp && (
                            <a
                              href={`https://wa.me/${pixWhatsApp.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${name}! Aqui é o admin do Bolão Copa 2026 BEL 🏆`)}`}
                              target="_blank" rel="noopener noreferrer"
                              title="Abrir WhatsApp"
                              className="w-8 h-8 flex items-center justify-center rounded-xl border border-green-200 text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors flex-shrink-0">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                              </svg>
                            </a>
                          )}
                          {/* Payment toggle */}
                          <button
                            onClick={() => togglePayment(p)}
                            disabled={togglingId === p.id}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all disabled:opacity-60
                              ${p.payment_ok
                                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
                            {togglingId === p.id
                              ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin"/>
                              : p.payment_ok
                                ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Confirmado</>
                                : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Confirmar pagto</>
                            }
                          </button>
                          {/* Delete */}
                          <button onClick={() => setConfirmDelete(p.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {filteredPlayers.length === 0 && playerSearch && (
                  <div className="text-center py-8 text-gray-400 text-[13px]">
                    Nenhum participante encontrado para <strong>"{playerSearch}"</strong>
                  </div>
                )}
              </div>
            </>
          )}

          {/* HISTORICO DE PAGAMENTOS */}
          {tab === 'logs' && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-gray-900 text-[14px]">Historico de pagamentos</p>
                  <span className="text-[12px] font-bold text-[#0099CC]">{paymentLogs.filter(l=>l.action==='confirmed').length} confirmados</span>
                </div>
                <p className="text-[11px] text-gray-400">Log de todas as confirmacoes e reversoes</p>
              </div>

              {paymentLogs.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3 opacity-40">
                    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  <p className="text-[13px]">Nenhum registro ainda</p>
                </div>
              ) : paymentLogs.map(log => (
                <div key={log.id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${log.action === 'confirmed' ? 'bg-green-100' : 'bg-red-100'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={log.action === 'confirmed' ? '#16A34A' : '#DC2626'} strokeWidth="2.5" strokeLinecap="round">
                      {log.action === 'confirmed'
                        ? <polyline points="20 6 9 17 4 12"/>
                        : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900">{log.player_name}</p>
                    <p className="text-[11px] text-gray-400">
                      {log.action === 'confirmed' ? 'Confirmado' : 'Revertido'} por @{log.confirmed_by} · R$ {Number(log.valor).toFixed(2).replace('.',',')}
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                    {new Date(log.created_at).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (() => {
        const p = players.find(pl => pl.id === confirmDelete)
        if (!p) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.5)'}}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
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
