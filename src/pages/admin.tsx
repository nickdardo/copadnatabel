import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Player, FASE_ORDER } from '@/lib/supabase'
import Head from 'next/head'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Tab = 'matches' | 'players' | 'stats'
type SyncResult = { ok: boolean; synced: number; updated: number; recalculated: boolean; quotaRemaining: number | null; error?: string }

function toBRT(d: string) {
  const dt = new Date(parseISO(d).getTime() - 3 * 60 * 60 * 1000)
  return format(dt, "dd/MM HH:mm", { locale: ptBR })
}

export default function AdminPage() {
  const { player, loading, isAdmin, logout } = useAuth()
  const router = useRouter()

  const [matches,     setMatches]     = useState<Match[]>([])
  const [players,     setPlayers]     = useState<Player[]>([])
  const [fetching,    setFetching]    = useState(true)
  const [tab,         setTab]         = useState<Tab>('matches')
  const [activePhase, setActivePhase] = useState('Fase de Grupos')
  const [syncing,     setSyncing]     = useState(false)
  const [syncResult,  setSyncResult]  = useState<SyncResult | null>(null)
  const [recalcing,   setRecalcing]   = useState(false)
  const [recalcMsg,   setRecalcMsg]   = useState('')
  const [editId,      setEditId]      = useState<string | null>(null)
  const [resH,        setResH]        = useState('')
  const [resA,        setResA]        = useState('')
  const [saving,      setSaving]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null) // player id to delete

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
    setFetching(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function triggerSync() {
    setSyncing(true); setSyncResult(null)
    try {
      const res  = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: process.env.NEXT_PUBLIC_ADMIN_NICKNAME }) })
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

  async function saveResult(match: Match) {
    if (resH === '' || resA === '') return
    setSaving(true)
    await supabase.from('matches').update({ score_home: Number(resH), score_away: Number(resA), status: 'done' }).eq('id', match.id)
    setSaving(false); setEditId(null)
    fetchAll(); await recalcScores()
  }

  async function togglePayment(p: Player) {
    await supabase.from('players').update({ payment_ok: !p.payment_ok }).eq('id', p.id)
    fetchAll()
  }

  async function deletePlayer(id: string) {
    // Delete picks, champion_picks, scores, edit_limits first (cascade should handle but being explicit)
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

  // Stats
  const nonAdminPlayers = players.filter(p => !p.is_admin)
  const paidCount       = nonAdminPlayers.filter(p => p.payment_ok).length
  const prizePool       = paidCount * 10
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
        <title>Admin · Bolão Copa 2026</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50 pb-6">
        {/* Header exclusivo admin */}
        <header className="bg-[#001e3c] border-b border-white/10 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/dnata-logo.png" alt="dnata" className="h-6 w-auto" />
              <div className="h-4 w-px bg-white/20" />
              <span className="text-[13px] text-white/70 font-medium">Painel Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-white/50">@{player?.username}</span>
              <button onClick={() => router.push('/ranking')}
                className="text-[12px] text-white/60 hover:text-white border border-white/20 px-3 py-1.5 rounded-lg transition-colors">
                Ver app
              </button>
              <button onClick={() => { logout(); router.push('/') }}
                className="text-[12px] text-white/60 hover:text-white transition-colors">
                Sair
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Participantes', value: nonAdminPlayers.length, icon: '👥', color: 'text-blue-600' },
              { label: 'Pagamentos',    value: `${paidCount}/${nonAdminPlayers.length}`, icon: '💰', color: 'text-green-600' },
              { label: 'Prêmio total',  value: `R$${prizePool}`, icon: '🏆', color: 'text-amber-600' },
              { label: 'Jogos',         value: `${doneCount}/${matches.length}`, icon: '⚽', color: 'text-gray-600' },
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
                  {syncResult.ok ? `✓ +${syncResult.synced} novos · ${syncResult.updated} atualizados${syncResult.quotaRemaining !== null ? ` · ${syncResult.quotaRemaining} req restantes` : ''}` : `✗ ${syncResult.error}`}
                </p>
              )}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 text-[14px] mb-0.5">Recalcular</p>
              <p className="text-[11px] text-gray-400 mb-3">Pontuações e ranking</p>
              <button onClick={recalcScores} disabled={recalcing}
                className="w-full py-2.5 rounded-xl bg-gray-800 text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-gray-900 disabled:opacity-50 transition-colors">
                {recalcing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Recalcular ranking'}
              </button>
              {recalcMsg && <p className="text-[11px] mt-2 text-green-600">✓ {recalcMsg}</p>}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {([['matches', `Partidas (${matches.length})`], ['players', `Participantes (${nonAdminPlayers.length})`]] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${tab === t ? 'bg-white text-[#0099CC] shadow-sm' : 'text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* PARTIDAS */}
          {tab === 'matches' && (
            <>
              {/* Status summary */}
              <div className="flex gap-2">
                {[
                  { label: 'Ao vivo', count: liveCount, color: 'bg-red-50 border-red-200 text-red-700' },
                  { label: 'Encerrados', count: doneCount, color: 'bg-gray-50 border-gray-200 text-gray-600' },
                  { label: 'Em breve', count: matches.length - liveCount - doneCount, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                ].map(s => (
                  <div key={s.label} className={`flex-1 text-center py-2 rounded-xl border text-[12px] font-semibold ${s.color}`}>
                    {s.count} {s.label}
                  </div>
                ))}
              </div>

              {/* Phase tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
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
                        {m.status === 'live'     && <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Ao vivo</span>}
                        {m.status === 'done'     && <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">Encerrado</span>}
                        {m.status === 'upcoming' && <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">Em breve</span>}
                        {m.match_date && <span className="text-[11px] text-gray-400">{toBRT(m.match_date)}</span>}
                        {m.group_name && <span className="text-[11px] text-gray-400">· {m.group_name}</span>}
                      </div>
                      <div className="flex gap-1">
                        {m.status !== 'live'     && <button onClick={() => setMatchStatus(m, 'live')}     className="text-[11px] text-red-600 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Ao vivo</button>}
                        {m.status !== 'upcoming' && <button onClick={() => setMatchStatus(m, 'upcoming')} className="text-[11px] border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">Reset</button>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-gray-800 flex items-center gap-1.5">
                        {m.home_flag} {m.home_team}
                      </span>

                      {editId === m.id ? (
                        <div className="flex items-center gap-1.5">
                          <input type="number" min="0" max="20" value={resH} onChange={e => setResH(e.target.value)}
                            className="w-11 h-10 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900" />
                          <span className="text-gray-400">×</span>
                          <input type="number" min="0" max="20" value={resA} onChange={e => setResA(e.target.value)}
                            className="w-11 h-10 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900" />
                          <button onClick={() => saveResult(m)} disabled={saving}
                            className="text-[11px] bg-[#0099CC] text-white px-3 py-2 rounded-xl hover:bg-[#007aa8] disabled:opacity-50">
                            {saving ? '...' : 'OK'}
                          </button>
                          <button onClick={() => setEditId(null)} className="text-[11px] border border-gray-200 px-2 py-2 rounded-xl hover:bg-gray-50">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {m.status === 'done' || m.status === 'live'
                            ? <span className={`text-[16px] font-bold ${m.status === 'live' ? 'text-red-600' : 'text-gray-800'}`}>{m.score_home} × {m.score_away}</span>
                            : <span className="text-gray-300 font-medium">vs</span>}
                          <button onClick={() => {
                            setEditId(m.id)
                            setResH(m.score_home !== null && m.score_home !== undefined ? String(m.score_home) : '')
                            setResA(m.score_away !== null && m.score_away !== undefined ? String(m.score_away) : '')
                          }} className="text-[11px] border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                            Editar
                          </button>
                        </div>
                      )}

                      <span className="text-[13px] font-semibold text-gray-800 flex items-center gap-1.5">
                        {m.away_team} {m.away_flag}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* PARTICIPANTES */}
          {tab === 'players' && (
            <>
              {/* Payment summary */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-gray-900 text-[14px]">Resumo de pagamentos</p>
                  <span className="text-[13px] font-bold text-[#0099CC]">R$ {prizePool},00 arrecadados</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0099CC] rounded-full transition-all"
                    style={{ width: nonAdminPlayers.length > 0 ? `${Math.round((paidCount / nonAdminPlayers.length) * 100)}%` : '0%' }} />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">{paidCount} de {nonAdminPlayers.length} confirmados</p>
              </div>

              <div className="space-y-2">
                {nonAdminPlayers.map(p => {
                  const av = p.avatar_url
                    ? (p.avatar_url.startsWith('http') ? p.avatar_url : supabase.storage.from('avatars').getPublicUrl(p.avatar_url).data.publicUrl)
                    : null
                  const name = p.nickname || p.username
                  return (
                    <div key={p.id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm">
                      {av ? (
                        <img src={av} alt={name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[11px] font-bold text-[#0099CC] flex-shrink-0">
                          {(name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-[14px] truncate">{name}</p>
                        <p className="text-[11px] text-gray-400">@{p.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => togglePayment(p)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all ${p.payment_ok
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
                          {p.payment_ok ? (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Confirmado</>
                          ) : (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Confirmar pagto</>
                          )}
                        </button>
                        {/* Delete button */}
                        <button onClick={() => setConfirmDelete(p.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
                          title="Excluir participante">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (() => {
        const p = players.find(pl => pl.id === confirmDelete)
        if (!p) return null
        const name = p.nickname || p.username
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
              <p className="text-[13px] text-gray-500 text-center mb-1">
                <strong>{name}</strong> (@{p.username})
              </p>
              <p className="text-[12px] text-red-500 text-center mb-5">
                Todos os palpites e dados serão apagados permanentemente.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-[14px] font-semibold hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={() => deletePlayer(p.id)}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-[14px] font-semibold hover:bg-red-600 transition-colors">
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
