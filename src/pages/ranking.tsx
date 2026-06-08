import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Score, Player, FACTOR_COLOR } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { IconTrophy, IconGold, IconSilver, IconBronze } from '@/components/Icons'

type RankEntry = Score & { player: Player }

const AVATAR_COLORS = [
  '#0099CC','#378ADD','#D85A30','#7F77DD',
  '#D4537E','#BA7517','#639922','#533AB7',
]

function initials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function MedalIcon({ pos }: { pos: number }) {
  if (pos === 1) return <IconGold size={28} />
  if (pos === 2) return <IconSilver size={28} />
  if (pos === 3) return <IconBronze size={28} />
  return <span className="text-[13px] font-bold text-gray-400">#{pos}</span>
}

export default function RankingPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [ranking, setRanking] = useState<RankEntry[]>([])
  const [fetching, setFetching] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')

  useEffect(() => {
    if (!loading && !player) router.push('/')
  }, [loading, player])

  useEffect(() => {
    if (!player) return
    fetchRanking()
    const channel = supabase
      .channel('scores-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, fetchRanking)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [player])

  async function fetchRanking() {
    const { data } = await supabase
      .from('scores').select('*, players(*)')
      .order('total_pts', { ascending: false })

    if (data) {
      const sorted = (data as any[]).map(d => ({ ...d, player: d.players }))
        .sort((a, b) => {
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
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  return (
    <Layout title="Ranking" step={3}>
      <div className="max-w-lg mx-auto px-4 py-4">

        {/* My position */}
        {myEntry && (
          <div className="bg-white border border-[#0099CC]/20 rounded-2xl p-4 mb-4"
               style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MedalIcon pos={myPos} />
                <div>
                  <div className="font-semibold text-gray-900 text-[15px]">{player?.nickname}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Minha posição</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[#0099CC]">{myEntry.total_pts}</div>
                <div className="text-[11px] text-gray-400">pontos</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {myEntry.f10_count > 0 && <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${FACTOR_COLOR['F10']}`}>{myEntry.f10_count}× F10</span>}
              {myEntry.f7_count  > 0 && <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${FACTOR_COLOR['F7']}`}>{myEntry.f7_count}× F7</span>}
              {myEntry.f5_count  > 0 && <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${FACTOR_COLOR['F5']}`}>{myEntry.f5_count}× F5</span>}
              {myEntry.f2_count  > 0 && <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${FACTOR_COLOR['F2']}`}>{myEntry.f2_count}× F2</span>}
              {myEntry.champion_pts > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-800">
                  +{myEntry.champion_pts} camp.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="space-y-2">
          {ranking.map((entry, i) => {
            const isMe  = entry.player_id === player?.id
            const pct   = Math.round((entry.total_pts / Math.max(maxPts, 1)) * 100)
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]

            return (
              <div key={entry.player_id}
                   className={`bg-white border rounded-2xl p-4 transition-all ${isMe ? 'border-[#0099CC]/30' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 flex items-center justify-center flex-shrink-0">
                    <MedalIcon pos={i + 1} />
                  </div>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                       style={{ background: color }}>
                    {initials(entry.player.nickname)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-[14px] truncate">
                      {entry.player.nickname}
                      {isMe && <span className="ml-1.5 text-[11px] text-[#0099CC] font-medium">(você)</span>}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {entry.f10_count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${FACTOR_COLOR['F10']}`}>{entry.f10_count}×F10</span>}
                      {entry.f7_count  > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${FACTOR_COLOR['F7']}`}>{entry.f7_count}×F7</span>}
                      {entry.f5_count  > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${FACTOR_COLOR['F5']}`}>{entry.f5_count}×F5</span>}
                      {entry.f2_count  > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${FACTOR_COLOR['F2']}`}>{entry.f2_count}×F2</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold" style={{ color: i === 0 ? '#0099CC' : '#1f2937' }}>
                      {entry.total_pts}
                    </div>
                    <div className="text-[10px] text-gray-400">pts</div>
                  </div>
                </div>
                <div className="mt-2.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>

        {ranking.length === 0 && (
          <div className="text-center py-14">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <IconTrophy size={24} className="text-gray-400" />
            </div>
            <p className="text-[14px] text-gray-400 leading-relaxed">
              Nenhum resultado ainda.<br />Aguarde o início dos jogos!
            </p>
          </div>
        )}

        {lastUpdate && (
          <p className="text-center text-[11px] text-gray-300 mt-4">
            Atualizado às {new Date(lastUpdate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </Layout>
  )
}
