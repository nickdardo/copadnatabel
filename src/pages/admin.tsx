'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, FASE_ORDER } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type SyncResult = {
  ok: boolean
  synced: number
  updated: number
  recalculated: boolean
  quotaRemaining: number | null
  timestamp: string
  error?: string
}

export default function AdminPage() {
  const { player, loading, isAdmin } = useAuth()
  const router = useRouter()

  const [matches, setMatches]         = useState<Match[]>([])
  const [fetching, setFetching]       = useState(true)
  const [syncing, setSyncing]         = useState(false)
  const [syncResult, setSyncResult]   = useState<SyncResult | null>(null)
  const [recalcing, setRecalcing]     = useState(false)
  const [recalcMsg, setRecalcMsg]     = useState('')
  const [editId, setEditId]           = useState<string | null>(null)
  const [resH, setResH]               = useState('')
  const [resA, setResA]               = useState('')
  const [saving, setSaving]           = useState(false)
  const [activePhase, setActivePhase] = useState('Fase de Grupos')

  useEffect(() => {
    if (!loading) {
      if (!player) { router.push('/'); return }
      if (!isAdmin) { router.push('/ranking'); return }
    }
  }, [loading, player, isAdmin])

  const fetchMatches = useCallback(async () => {
    const { data } = await supabase.from('matches').select('*').order('sort_order')
    setMatches((data || []) as Match[])
    setFetching(false)
    // Set default active phase to first with live/upcoming
    const ms = (data || []) as Match[]
    const firstActive = FASE_ORDER.find(f =>
      ms.some(m => m.fase === f && (m.status === 'live' || m.status === 'upcoming'))
    ) || FASE_ORDER.find(f => ms.some(m => m.fase === f)) || 'Fase de Grupos'
    setActivePhase(prev => prev || firstActive)
  }, [])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  // ── Sync from The Odds API ─────────────────────────────────────────────────
  async function triggerSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: process.env.NEXT_PUBLIC_ADMIN_NICKNAME }), // lightweight
      })
      const data: SyncResult = await res.json()
      setSyncResult(data)
      if (data.ok) fetchMatches()
    } catch {
      setSyncResult({ ok: false, synced: 0, updated: 0, recalculated: false, quotaRemaining: null, timestamp: new Date().toISOString(), error: 'Erro de rede' })
    }
    setSyncing(false)
  }

  // ── Manual recalc ─────────────────────────────────────────────────────────
  async function recalcScores() {
    setRecalcing(true)
    const { error } = await supabase.rpc('recalc_all_scores')
    setRecalcMsg(error ? '❌ Erro ao recalcular.' : '✅ Pontuações recalculadas!')
    setTimeout(() => setRecalcMsg(''), 3000)
    setRecalcing(false)
  }

  // ── Manual result override ────────────────────────────────────────────────
  async function saveResult(match: Match) {
    if (resH === '' || resA === '') return
    setSaving(true)
    await supabase
      .from('matches')
      .update({ score_home: Number(resH), score_away: Number(resA), status: 'done' })
      .eq('id', match.id)
    setSaving(false)
    setEditId(null)
    fetchMatches()
    await recalcScores()
  }

  async function setLive(match: Match) {
    await supabase.from('matches').update({ status: 'live' }).eq('id', match.id)
    fetchMatches()
  }
  async function setUpcoming(match: Match) {
    await supabase.from('matches').update({ status: 'upcoming', score_home: null, score_away: null }).eq('id', match.id)
    fetchMatches()
  }

  const phases = FASE_ORDER.filter(f => matches.some(m => m.fase === f))
  const filteredMatches = matches.filter(m => m.fase === activePhase)

  if (loading || fetching || !isAdmin) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#1D9E75]/30 border-t-[#1D9E75] rounded-full animate-spin" />
    </div>
  )

  return (
    <Layout title="Admin" step={-1}>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* ── Sync card ── */}
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                ⚡ Sincronizar com The Odds API
                <span className="badge bg-green-100 text-green-800 text-[10px]">Automático a cada 5 min</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Busca jogos + placares ao vivo. Cron roda automaticamente no Vercel.
              </div>
            </div>
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="btn btn-primary flex-shrink-0"
            >
              {syncing
                ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : '🔄 Sincronizar agora'}
            </button>
          </div>

          {/* Result feedback */}
          {syncResult && (
            <div className={`rounded-xl px-4 py-3 text-sm ${syncResult.ok ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
              {syncResult.ok ? (
                <div className="space-y-1">
                  <div className="font-medium text-green-800">✅ Sincronização concluída</div>
                  <div className="text-green-700 text-xs flex gap-4 flex-wrap">
                    <span>🆕 {syncResult.synced} novos jogos</span>
                    <span>📝 {syncResult.updated} atualizados</span>
                    {syncResult.recalculated && <span>🏆 Ranking recalculado</span>}
                    {syncResult.quotaRemaining !== null && (
                      <span>📊 {syncResult.quotaRemaining} requests restantes hoje</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-red-700">❌ Erro: {syncResult.error}</div>
              )}
            </div>
          )}

          {/* Cron info */}
          <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 space-y-1">
            <div>🤖 <strong>Automático:</strong> Vercel Cron executa /api/sync a cada 5 minutos</div>
            <div>💰 <strong>Consumo:</strong> ~1 request por sync (scores) + 0 para fixtures</div>
            <div>🔑 <strong>API key:</strong> protegida no servidor, nunca exposta no frontend</div>
          </div>
        </div>

        {/* ── Recalc manual ── */}
        <div className="card flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-900">Recalcular pontuações</div>
            <div className="text-xs text-gray-400">Execute manualmente se necessário</div>
          </div>
          <div className="flex items-center gap-2">
            {recalcMsg && <span className="text-sm text-[#1D9E75]">{recalcMsg}</span>}
            <button onClick={recalcScores} disabled={recalcing} className="btn btn-primary">
              {recalcing
                ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : '📊 Recalcular'}
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total jogos', value: matches.length, icon: '⚽' },
            { label: 'Ao vivo',     value: matches.filter(m => m.status === 'live').length,     icon: '🔴' },
            { label: 'Encerrados',  value: matches.filter(m => m.status === 'done').length,     icon: '✅' },
          ].map(s => (
            <div key={s.label} className="card text-center py-3">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Phase tabs ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {phases.map(f => {
            const hasLive = matches.some(m => m.fase === f && m.status === 'live')
            return (
              <button
                key={f}
                onClick={() => setActivePhase(f)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1
                  ${activePhase === f ? 'bg-[#1D9E75] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
              >
                {hasLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                {f === 'Fase de Grupos' ? 'Grupos' : f}
                <span className="text-xs opacity-70 ml-1">
                  ({matches.filter(m => m.fase === f).length})
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Match list ── */}
        <div className="space-y-2">
          {filteredMatches.length === 0 && (
            <div className="card text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">⚽</div>
              <p className="text-sm">Nenhum jogo nesta fase ainda.<br />Clique em Sincronizar para buscar.</p>
            </div>
          )}
          {filteredMatches.map(m => (
            <div key={m.id} className="card">
              {/* Status + date */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {m.status === 'live'     && <span className="badge bg-red-100 text-red-700 animate-pulse text-xs">● Ao vivo</span>}
                  {m.status === 'done'     && <span className="badge bg-gray-100 text-gray-600 text-xs">✅ Encerrado</span>}
                  {m.status === 'upcoming' && <span className="badge bg-blue-50 text-blue-700 text-xs">🕐 Em breve</span>}
                  {m.match_date && (
                    <span className="text-xs text-gray-400">
                      {format(parseISO(m.match_date), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {/* Quick status buttons */}
                <div className="flex gap-1">
                  {m.status !== 'live'     && <button onClick={() => setLive(m)}     className="btn text-xs py-1 px-2 text-red-600 border-red-200 hover:bg-red-50">Ao vivo</button>}
                  {m.status !== 'upcoming' && <button onClick={() => setUpcoming(m)} className="btn text-xs py-1 px-2">Reset</button>}
                </div>
              </div>

              {/* Teams + score */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="text-sm font-semibold text-gray-900 text-right">{m.home_team}</span>
                  <span className="text-xl">{m.home_flag}</span>
                </div>

                {/* Score or edit */}
                {editId === m.id ? (
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="0" max="20" value={resH}
                      onChange={e => setResH(e.target.value)}
                      className="w-11 h-10 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900" />
                    <span className="text-gray-400">×</span>
                    <input type="number" min="0" max="20" value={resA}
                      onChange={e => setResA(e.target.value)}
                      className="w-11 h-10 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900" />
                    <button onClick={() => saveResult(m)} disabled={saving} className="btn btn-primary text-xs py-1 px-2">
                      {saving ? '...' : 'OK'}
                    </button>
                    <button onClick={() => setEditId(null)} className="btn text-xs py-1 px-2">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {(m.status === 'done' || m.status === 'live') && m.score_home !== undefined && m.score_home !== null
                      ? <span className={`text-xl font-bold ${m.status === 'live' ? 'text-red-600' : 'text-gray-800'}`}>
                          {m.score_home} × {m.score_away}
                        </span>
                      : <span className="text-gray-300 font-medium px-2">vs</span>}
                    <button
                      onClick={() => {
                        setEditId(m.id)
                        setResH(m.score_home !== undefined && m.score_home !== null ? String(m.score_home) : '')
                        setResA(m.score_away !== undefined && m.score_away !== null ? String(m.score_away) : '')
                      }}
                      className="btn text-xs py-1 px-2"
                    >
                      ✏️
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xl">{m.away_flag}</span>
                  <span className="text-sm font-semibold text-gray-900">{m.away_team}</span>
                </div>
              </div>

              {/* Odds event ID for debug */}
              {m.odds_event_id && (
                <div className="mt-2 text-[10px] text-gray-300 font-mono truncate">
                  🔗 {m.odds_event_id}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
