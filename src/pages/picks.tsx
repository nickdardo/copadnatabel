'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Pick, calcFactor, FACTOR_PTS, FACTOR_COLOR, FASE_ORDER } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PickMap = Record<string, { home: string; away: string; saved: boolean }>

export default function PicksPage() {
  const { player, loading } = useAuth()
  const router = useRouter()

  const [matches, setMatches]   = useState<Match[]>([])
  const [picks, setPicks]       = useState<PickMap>({})
  const [saving, setSaving]     = useState<Record<string, boolean>>({})
  const [fetching, setFetching] = useState(true)
  const [activePhase, setActivePhase] = useState<string>('')

  useEffect(() => {
    if (!loading && !player) router.push('/')
  }, [loading, player])

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

    // Set default active phase = first with upcoming or live matches
    const phases = FASE_ORDER.filter(f => ms.some(m => m.fase === f))
    const firstActive = phases.find(f =>
      ms.some(m => m.fase === f && (m.status === 'upcoming' || m.status === 'live'))
    ) || phases[phases.length - 1] || phases[0]
    setActivePhase(firstActive)
    setFetching(false)
  }, [player])

  useEffect(() => { fetchData() }, [fetchData])

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
      player_id: player.id,
      match_id: match.id,
      pick_home: Number(pick.home),
      pick_away: Number(pick.away),
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'player_id,match_id' })
    setSaving(s => ({ ...s, [match.id]: false }))
    setPicks(p => ({ ...p, [match.id]: { ...p[match.id], saved: true } }))
  }

  const phases = FASE_ORDER.filter(f => matches.some(m => m.fase === f))
  const filteredMatches = matches.filter(m => m.fase === activePhase)

  const isLocked = (m: Match) =>
    m.status === 'done' || m.status === 'live' ||
    (m.match_date ? isPast(parseISO(m.match_date)) : false)

  function matchStatusBadge(m: Match) {
    if (m.status === 'live') return <span className="badge bg-red-100 text-red-700 animate-pulse">● Ao vivo</span>
    if (m.status === 'done') return <span className="badge bg-gray-100 text-gray-600">Encerrado</span>
    return <span className="badge bg-blue-50 text-blue-700">Em breve</span>
  }

  function factorBadge(m: Match, pick: { home: string; away: string }) {
    if (m.status !== 'done' || m.score_home === undefined) return null
    if (pick.home === '' || pick.away === '') return null
    const f = calcFactor(Number(pick.home), Number(pick.away), m.score_home!, m.score_away!)
    return (
      <span className={`badge ${FACTOR_COLOR[f]} font-semibold`}>
        {f} +{FACTOR_PTS[f]}pts
      </span>
    )
  }

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#1D9E75]/30 border-t-[#1D9E75] rounded-full animate-spin" />
    </div>
  )

  return (
    <Layout title="Palpites" step={2}>
      <div className="max-w-lg mx-auto px-4 py-4">

        {/* Phase tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
          {phases.map(f => {
            const hasLive = matches.some(m => m.fase === f && m.status === 'live')
            const label = f === 'Fase de Grupos' ? 'Grupos' : f
            return (
              <button
                key={f}
                onClick={() => setActivePhase(f)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1
                  ${activePhase === f
                    ? 'bg-[#1D9E75] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {hasLive && <span className="w-2 h-2 rounded-full bg-red-500" />}
                {label}
              </button>
            )
          })}
        </div>

        {/* Match cards */}
        <div className="space-y-3">
          {filteredMatches.map(m => {
            const pick = picks[m.id] || { home: '', away: '', saved: false }
            const locked = isLocked(m)

            return (
              <div key={m.id} className="card">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {matchStatusBadge(m)}
                    {m.match_date && (
                      <span className="text-xs text-gray-400">
                        {format(parseISO(m.match_date), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{m.fase}</span>
                </div>

                {/* Teams + score inputs */}
                <div className="flex items-center justify-between gap-3">
                  {/* Home */}
                  <div className="flex-1 text-right">
                    <div className="text-lg">{m.home_flag}</div>
                    <div className="text-sm font-semibold text-gray-900 leading-tight">{m.home_team}</div>
                  </div>

                  {/* Score inputs or result */}
                  <div className="flex items-center gap-2">
                    {locked ? (
                      <>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold
                          ${pick.home === '' ? 'bg-gray-100 text-gray-300' : 'bg-gray-50 text-gray-800 border border-gray-200'}`}>
                          {pick.home !== '' ? pick.home : '–'}
                        </div>
                        <span className="text-gray-400 font-medium">×</span>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold
                          ${pick.away === '' ? 'bg-gray-100 text-gray-300' : 'bg-gray-50 text-gray-800 border border-gray-200'}`}>
                          {pick.away !== '' ? pick.away : '–'}
                        </div>
                      </>
                    ) : (
                      <>
                        <input
                          type="number" min="0" max="20"
                          className="score-box"
                          value={pick.home}
                          onChange={e => updatePick(m.id, 'home', e.target.value)}
                          placeholder="0"
                        />
                        <span className="text-gray-400 font-medium">×</span>
                        <input
                          type="number" min="0" max="20"
                          className="score-box"
                          value={pick.away}
                          onChange={e => updatePick(m.id, 'away', e.target.value)}
                          placeholder="0"
                        />
                      </>
                    )}
                  </div>

                  {/* Away */}
                  <div className="flex-1">
                    <div className="text-lg">{m.away_flag}</div>
                    <div className="text-sm font-semibold text-gray-900 leading-tight">{m.away_team}</div>
                  </div>
                </div>

                {/* Result row */}
                {m.status === 'done' && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Resultado oficial: <strong>{m.score_home} × {m.score_away}</strong>
                    </span>
                    {factorBadge(m, pick)}
                  </div>
                )}

                {/* Save button */}
                {!locked && (
                  <button
                    onClick={() => savePick(m)}
                    disabled={saving[m.id] || pick.home === '' || pick.away === ''}
                    className={`mt-3 w-full py-2 rounded-xl text-sm font-medium transition-all
                      ${pick.saved
                        ? 'bg-green-50 text-[#1D9E75] border border-green-200'
                        : 'btn btn-primary'}`}
                  >
                    {saving[m.id]
                      ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : pick.saved ? '✅ Salvo' : 'Salvar palpite'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
