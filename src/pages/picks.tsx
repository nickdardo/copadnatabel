import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Pick, calcFactor, FACTOR_PTS, FACTOR_COLOR, FASE_ORDER } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { IconCheck, IconLive, IconBall } from '@/components/Icons'
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
  const [activePhase, setActivePhase] = useState('')

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
      player_id: player.id, match_id: match.id,
      pick_home: Number(pick.home), pick_away: Number(pick.away),
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

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  return (
    <Layout title="Palpites" step={2}>
      <div className="max-w-lg mx-auto px-4 py-4">

        {/* Phase tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: 'none' }}>
          {phases.map(f => {
            const hasLive = matches.some(m => m.fase === f && m.status === 'live')
            const label   = f === 'Fase de Grupos' ? 'Grupos' : f
            return (
              <button key={f} onClick={() => setActivePhase(f)}
                className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all flex items-center gap-1.5
                  ${activePhase === f ? 'bg-[#0099CC] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {hasLive && <IconLive size={7} className="animate-pulse" />}
                {label}
              </button>
            )
          })}
        </div>

        {/* Match cards */}
        <div className="space-y-3">
          {filteredMatches.map(m => {
            const pick   = picks[m.id] || { home: '', away: '', saved: false }
            const locked = isLocked(m)
            const factor = m.status === 'done' && m.score_home !== undefined && pick.home !== ''
              ? calcFactor(Number(pick.home), Number(pick.away), m.score_home!, m.score_away!)
              : null

            return (
              <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {m.status === 'live' && (
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg">
                        <IconLive size={6} className="animate-pulse" /> Ao vivo
                      </span>
                    )}
                    {m.status === 'done' && (
                      <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">Encerrado</span>
                    )}
                    {m.status === 'upcoming' && (
                      <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">Em breve</span>
                    )}
                    {m.match_date && (
                      <span className="text-[11px] text-gray-400">
                        {format(parseISO(m.match_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  {factor && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${FACTOR_COLOR[factor]}`}>
                      +{FACTOR_PTS[factor]}pts · {factor}
                    </span>
                  )}
                </div>

                {/* Teams + inputs */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 text-right">
                    <div className="text-lg mb-0.5">{m.home_flag}</div>
                    <div className="text-[13px] font-semibold text-gray-800">{m.home_team}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {locked ? (
                      <>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border
                          ${pick.home !== '' ? 'bg-gray-50 text-gray-800 border-gray-200' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                          {pick.home !== '' ? pick.home : '–'}
                        </div>
                        <span className="text-gray-300 font-medium text-lg">×</span>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border
                          ${pick.away !== '' ? 'bg-gray-50 text-gray-800 border-gray-200' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                          {pick.away !== '' ? pick.away : '–'}
                        </div>
                      </>
                    ) : (
                      <>
                        <input type="number" min="0" max="20" className="w-12 h-12 text-center text-xl font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC]"
                          value={pick.home} onChange={e => updatePick(m.id, 'home', e.target.value)} placeholder="0" />
                        <span className="text-gray-300 font-medium text-lg">×</span>
                        <input type="number" min="0" max="20" className="w-12 h-12 text-center text-xl font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC]"
                          value={pick.away} onChange={e => updatePick(m.id, 'away', e.target.value)} placeholder="0" />
                      </>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="text-lg mb-0.5">{m.away_flag}</div>
                    <div className="text-[13px] font-semibold text-gray-800">{m.away_team}</div>
                  </div>
                </div>

                {/* Result official */}
                {m.status === 'done' && m.score_home !== undefined && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      Resultado: <strong className="text-gray-700">{m.score_home} × {m.score_away}</strong>
                    </span>
                  </div>
                )}

                {/* Save button */}
                {!locked && (
                  <button onClick={() => savePick(m)}
                    disabled={saving[m.id] || pick.home === '' || pick.away === ''}
                    className={`mt-3 w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2
                      ${pick.saved
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-[#0099CC] text-white hover:bg-[#007aa8] disabled:opacity-40 disabled:cursor-not-allowed'}`}>
                    {saving[m.id]
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : pick.saved
                        ? <><IconCheck size={14} className="text-green-600" /> Salvo</>
                        : <>Salvar palpite</>}
                  </button>
                )}
              </div>
            )
          })}

          {filteredMatches.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <IconBall size={22} className="text-gray-400" />
              </div>
              <p className="text-[13px] text-gray-400">Nenhuma partida nesta fase ainda.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
