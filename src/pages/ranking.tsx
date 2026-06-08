'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Score, Player, FACTOR_COLOR } from '@/lib/supabase'
import Layout from '@/components/Layout'

type RankEntry = Score & { player: Player }

const AVATAR_COLORS = [
  '#1D9E75','#378ADD','#D85A30','#7F77DD',
  '#D4537E','#BA7517','#639922','#533AB7',
]

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function medalIcon(pos: number) {
  if (pos === 1) return '🥇'
  if (pos === 2) return '🥈'
  if (pos === 3) return '🥉'
  return null
}

export default function RankingPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [ranking, setRanking] = useState<RankEntry[]>([])
  const [fetching, setFetching] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  useEffect(() => {
    if (!loading && !player) router.push('/')
  }, [loading, player])

  useEffect(() => {
    if (!player) return
    fetchRanking()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('scores-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, fetchRanking)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [player])

  async function fetchRanking() {
    const { data } = await supabase
      .from('scores')
      .select('*, players(*)')
      .order('total_pts', { ascending: false })

    if (data) {
      // Apply tiebreak sorting client-side
      const sorted = (data as any[]).map(d => ({
        ...d, player: d.players,
      })).sort((a, b) => {
        if (b.total_pts !== a.total_pts) return b.total_pts - a.total_pts
        if (b.f10_count !== a.f10_count) return b.f10_count - a.f10_count
        if (b.f7_count  !== a.f7_count)  return b.f7_count  - a.f7_count
        if (b.f5_count  !== a.f5_count)  return b.f5_count  - a.f5_count
        if (b.f2_count  !== a.f2_count)  return b.f2_count  - a.f2_count
        if (a.f0_count  !== b.f0_count)  return a.f0_count  - b.f0_count
        return new Date(a.players.created_at).getTime() - new Date(b.players.created_at).getTime()
      })
      setRanking(sorted)
      if (sorted[0]) setLastUpdate(sorted[0].updated_at)
    }
    setFetching(false)
  }

  const myEntry = ranking.find(r => r.player_id === player?.id)
  const myPos   = ranking.findIndex(r => r.player_id === player?.id) + 1
  const maxPts  = ranking[0]?.total_pts || 1

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#1D9E75]/30 border-t-[#1D9E75] rounded-full animate-spin" />
    </div>
  )

  return (
    <Layout title="Ranking" step={3}>
      <div className="max-w-lg mx-auto px-4 py-4">

        {/* My position card */}
        {myEntry && (
          <div className="card mb-4 bg-gradient-to-r from-[#E1F5EE] to-white border-[#1D9E75]/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{medalIcon(myPos) || `#${myPos}`}</div>
                <div>
                  <div className="font-semibold text-gray-900">{player?.nickname}</div>
                  <div className="text-xs text-gray-500">Minha posição</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[#1D9E75]">{myEntry.total_pts}</div>
                <div className="text-xs text-gray-400">pontos</div>
              </div>
            </div>
            {/* Factor breakdown */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {myEntry.f10_count > 0 && <span className={`badge ${FACTOR_COLOR['F10']}`}>{myEntry.f10_count}× F10</span>}
              {myEntry.f7_count  > 0 && <span className={`badge ${FACTOR_COLOR['F7']}`}>{myEntry.f7_count}× F7</span>}
              {myEntry.f5_count  > 0 && <span className={`badge ${FACTOR_COLOR['F5']}`}>{myEntry.f5_count}× F5</span>}
              {myEntry.f2_count  > 0 && <span className={`badge ${FACTOR_COLOR['F2']}`}>{myEntry.f2_count}× F2</span>}
              {myEntry.champion_pts > 0 && <span className="badge bg-amber-100 text-amber-800">🏆 +{myEntry.champion_pts} camp.</span>}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="space-y-2">
          {ranking.map((entry, i) => {
            const isMe = entry.player_id === player?.id
            const pct  = Math.round((entry.total_pts / Math.max(maxPts, 1)) * 100)
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const medal = medalIcon(i + 1)

            return (
              <div
                key={entry.player_id}
                className={`card transition-all ${isMe ? 'ring-2 ring-[#1D9E75]/30' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Position */}
                  <div className="w-8 text-center">
                    {medal
                      ? <span className="text-xl">{medal}</span>
                      : <span className="text-sm font-semibold text-gray-400">#{i + 1}</span>}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                    style={{ background: color }}
                  >
                    {initials(entry.player.nickname)}
                  </div>

                  {/* Name + factors */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {entry.player.nickname}
                      {isMe && <span className="ml-1 text-xs text-[#1D9E75]">(você)</span>}
                    </div>
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {entry.f10_count > 0 && <span className={`badge text-[10px] ${FACTOR_COLOR['F10']}`}>{entry.f10_count}×F10</span>}
                      {entry.f7_count  > 0 && <span className={`badge text-[10px] ${FACTOR_COLOR['F7']}`}>{entry.f7_count}×F7</span>}
                      {entry.f5_count  > 0 && <span className={`badge text-[10px] ${FACTOR_COLOR['F5']}`}>{entry.f5_count}×F5</span>}
                      {entry.f2_count  > 0 && <span className={`badge text-[10px] ${FACTOR_COLOR['F2']}`}>{entry.f2_count}×F2</span>}
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold" style={{ color: i === 0 ? '#1D9E75' : undefined }}>
                      {entry.total_pts}
                    </div>
                    <div className="text-[10px] text-gray-400">pts</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {ranking.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">🏟️</div>
            <p className="text-sm">Nenhum resultado ainda.<br />Aguarde o início dos jogos!</p>
          </div>
        )}

        {lastUpdate && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Atualizado às {new Date(lastUpdate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </Layout>
  )
}
