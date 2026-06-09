import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Score, Player } from '@/lib/supabase'
import FlagImg from '@/components/FlagImg'
import Layout from '@/components/Layout'

type ChampPick = { pick_champion: string; pick_runner: string; pick_third: string }
type RankEntry  = Score & { player: Player; champ?: ChampPick }

const COLORS = ['#0099CC','#1565C0','#7B1FA2','#C62828','#2E7D32','#F57F17','#00838F','#4527A0']

function initials(n: string) {
  return (n||'?').split(' ').filter(Boolean).map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()
}

function getAvatarUrl(p: Player): string | null {
  if (!p?.avatar_url) return null
  if (p.avatar_url.startsWith('http')) return p.avatar_url
  try {
    const { data } = supabase.storage.from('avatars').getPublicUrl(p.avatar_url)
    return data?.publicUrl || null
  } catch { return null }
}

function PicksBar({ count, total }: { count: number; total: number }) {
  if (!total) return null
  const pct = Math.min(Math.round((count/total)*100), 100)
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#0099CC]/50" style={{ width:`${pct}%` }}/>
      </div>
      <span className="text-[10px] text-gray-400 whitespace-nowrap">{count}/{total}</span>
    </div>
  )
}

function Medal({ pos }: { pos: number }) {
  if (pos === 1) return <svg width="26" height="26" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="26" r="11" fill="#FFF8E1" stroke="#B8860B" strokeWidth="1.5"/><path d="M13 14 11 7l9 3 9-3-2 7" fill="#FFD700" stroke="#B8860B" strokeWidth="1.2" strokeLinejoin="round"/><text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7a5800" fontFamily="sans-serif">1</text></svg>
  if (pos === 2) return <svg width="26" height="26" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="26" r="11" fill="#F5F5F5" stroke="#6C757D" strokeWidth="1.5"/><path d="M13 14 11 7l9 3 9-3-2 7" fill="#CED4DA" stroke="#6C757D" strokeWidth="1.2" strokeLinejoin="round"/><text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#495057" fontFamily="sans-serif">2</text></svg>
  if (pos === 3) return <svg width="26" height="26" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="26" r="11" fill="#FFF0E6" stroke="#A0522D" strokeWidth="1.5"/><path d="M13 14 11 7l9 3 9-3-2 7" fill="#E8A87C" stroke="#A0522D" strokeWidth="1.2" strokeLinejoin="round"/><text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7B3F00" fontFamily="sans-serif">3</text></svg>
  return <span className="text-[13px] font-bold text-gray-400 w-[26px] text-center block">{pos}º</span>
}

export default function RankingPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [ranking,    setRanking]    = useState<RankEntry[]>([])
  const [fetching,   setFetching]   = useState(true)
  const [expanded,   setExpanded]   = useState<string|null>(null)
  const [showAll,    setShowAll]    = useState(false)
  const [totalMatches, setTotalMatches] = useState(72)

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  useEffect(() => {
    if (!player) return
    load()
    const ch = supabase.channel('scores-rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'scores' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [player])

  async function load() {
    const [{ data: scores }, { data: players }, { data: champs }, { count }] = await Promise.all([
      supabase.from('scores').select('*').order('total_pts', { ascending: false }),
      supabase.from('players').select('*'),
      supabase.from('champion_picks').select('*'),
      supabase.from('matches').select('*', { count:'exact', head:true }),
    ])
    if (!scores || !players) { setFetching(false); return }

    setTotalMatches(count || 72)

    const playerMap: Record<string, Player> = {}
    players.forEach((p:Player) => { playerMap[p.id] = p })

    const champMap: Record<string, ChampPick> = {}
    ;(champs||[]).forEach((c:any) => { champMap[c.player_id] = c })

    const sorted = scores
      .map((s:any) => ({
        ...s,
        player: playerMap[s.player_id],
        champ: champMap[s.player_id],
      }))
      .filter((e:any) => e.player && !e.player.is_admin)
      .sort((a:any, b:any) => {
        if (b.total_pts !== a.total_pts) return b.total_pts - a.total_pts
        if (b.f10_count !== a.f10_count) return b.f10_count - a.f10_count
        if (b.f7_count  !== a.f7_count)  return b.f7_count  - a.f7_count
        if (b.f5_count  !== a.f5_count)  return b.f5_count  - a.f5_count
        return 0
      })

    setRanking(sorted)
    setFetching(false)
  }

  const me    = ranking.find(r => r.player_id === player?.id)
  const myPos = ranking.findIndex(r => r.player_id === player?.id) + 1
  const list  = showAll ? ranking : ranking.slice(0, 10)

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
    </div>
  )

  return (
    <Layout title="Ranking">
      <div className="max-w-lg mx-auto">

        {/* Hero banner — my position */}
        {me && (
          <div className="relative overflow-hidden mb-1"
            style={{ background:'linear-gradient(135deg,#003a6e 0%,#0064a8 55%,#0099CC 100%)' }}>
            <div className="relative flex items-center gap-4 px-5 py-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {getAvatarUrl(me.player)
                  ? <img src={getAvatarUrl(me.player)!} alt=""
                      className="w-16 h-16 rounded-full object-cover"
                      style={{ border:'3px solid rgba(255,255,255,0.9)' }}/>
                  : <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-xl font-bold text-[#0099CC]"
                      style={{ border:'3px solid rgba(255,255,255,0.9)' }}>
                      {initials(me.player.nickname || me.player.username)}
                    </div>
                }
                <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-[#FFD700] border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#7a5800]">
                  {myPos}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-[17px] truncate uppercase">
                  {me.player.nickname || me.player.username}
                </p>
                <p className="text-white/60 text-[11px] mt-0.5">
                  F10:{me.f10_count} · F7:{me.f7_count} · F5:{me.f5_count} · F2:{me.f2_count}
                  {me.champion_pts > 0 && ` · Bônus:+${me.champion_pts}`}
                </p>
                {/* Champion picks */}
                {me.champ && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-white/50 text-[10px]">Palpites:</span>
                    {[me.champ.pick_champion, me.champ.pick_runner, me.champ.pick_third].map((t,i) => (
                      <FlagImg key={i} team={t} size={20}/>
                    ))}
                  </div>
                )}
                <PicksBar count={me.picks_count||0} total={totalMatches}/>
              </div>

              {/* Points */}
              <div className="text-right flex-shrink-0">
                <p className="text-white font-bold text-[32px] leading-none">{me.total_pts}</p>
                <p className="text-white/50 text-[11px]">pts</p>
              </div>
            </div>

            {/* Payment status */}
            {me.player.payment_ok
              ? <div className="bg-green-500/20 border-t border-green-400/30 px-5 py-2 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86EFAC" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="text-green-200 text-[11px] font-medium">Pagamento confirmado!</span>
                </div>
              : <div className="bg-amber-500/20 border-t border-amber-400/30 px-5 py-2 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span className="text-amber-200 text-[11px] font-medium">Pagamento pendente · R$10,00 para Aristone Figueredo</span>
                </div>
            }
          </div>
        )}

        {/* List header */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
          <p className="text-[12px] text-gray-500 font-semibold">{ranking.length} participante{ranking.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Ranking list */}
        <div className="divide-y divide-gray-100">
          {list.map((entry, i) => {
            const isMe   = entry.player_id === player?.id
            const isOpen = expanded === entry.player_id
            const name   = entry.player.nickname || entry.player.username
            const photo  = getAvatarUrl(entry.player)
            const color  = COLORS[i % COLORS.length]

            return (
              <div key={entry.player_id}>
                {/* Row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : entry.player_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50
                    ${i===0?'bg-[#0099CC]/5':i===1?'bg-[#0077b6]/4':i===2?'bg-[#48cae4]/3':''}
                    ${isMe?'ring-inset ring-1 ring-[#0099CC]/20':''}`}>

                  <div className="w-7 flex-shrink-0 flex justify-center">
                    <Medal pos={i+1}/>
                  </div>

                  {photo
                    ? <img src={photo} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm"/>
                    : <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white border-2 border-white shadow-sm"
                        style={{ background: color }}>
                        {initials(name)}
                      </div>
                  }

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[14px] text-gray-900 truncate">{name}</span>
                      {isMe && <span className="text-[10px] text-[#0099CC] font-semibold bg-[#0099CC]/10 px-1.5 py-0.5 rounded-full">você</span>}
                      {entry.player.payment_ok
                        ? <span className="text-[9px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">pago</span>
                        : <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">pend.</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      F10:{entry.f10_count} · F7:{entry.f7_count} · F5:{entry.f5_count} · F2:{entry.f2_count}
                    </p>
                    <PicksBar count={entry.picks_count||0} total={totalMatches}/>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className={`font-bold text-[17px] leading-none ${i===0?'text-[#0099CC]':'text-gray-800'}`}>{entry.total_pts}</p>
                      <p className="text-[10px] text-gray-400">pts</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"
                      className={`transition-transform ${isOpen?'rotate-180':''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="bg-gray-50 border-b border-gray-100 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Pontuação</p>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            {k:'f10_count',l:'F10',c:'bg-green-100 text-green-800',p:10},
                            {k:'f7_count', l:'F7', c:'bg-blue-100 text-blue-800',  p:7 },
                            {k:'f5_count', l:'F5', c:'bg-amber-100 text-amber-800',p:5 },
                            {k:'f2_count', l:'F2', c:'bg-pink-100 text-pink-800',  p:2 },
                            {k:'f0_count', l:'F0', c:'bg-gray-100 text-gray-600',  p:0 },
                          ].map(({k,l,c,p}) => (
                            <div key={k} className={`px-2.5 py-1.5 rounded-xl text-center ${c}`}>
                              <p className="text-[10px] font-semibold">{l}</p>
                              <p className="text-[14px] font-bold">{(entry as any)[k]}</p>
                              <p className="text-[9px] opacity-70">{(entry as any)[k]*p}pts</p>
                            </div>
                          ))}
                          {entry.champion_pts > 0 && (
                            <div className="px-2.5 py-1.5 rounded-xl text-center bg-amber-100 text-amber-800">
                              <p className="text-[10px] font-semibold">Bônus</p>
                              <p className="text-[14px] font-bold">+{entry.champion_pts}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {entry.champ && (
                        <div className="text-right">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Campeões</p>
                          <div className="space-y-1.5">
                            {[
                              {label:'🥇', team: entry.champ.pick_champion},
                              {label:'🥈', team: entry.champ.pick_runner},
                              {label:'🥉', team: entry.champ.pick_third},
                            ].map(({label, team}) => (
                              <div key={label} className="flex items-center gap-2 justify-end">
                                <span className="text-[12px] text-gray-500">{team}</span>
                                <FlagImg team={team} size={22}/>
                                <span>{label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Show more / less */}
        {ranking.length > 10 && (
          <div className="px-4 py-3">
            <button onClick={() => setShowAll(s => !s)}
              className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-[13px] font-semibold text-[#0099CC] hover:bg-gray-50 transition-colors">
              {showAll ? 'Mostrar menos' : `Ver todos os ${ranking.length} participantes`}
            </button>
          </div>
        )}

        {ranking.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-400">Nenhum resultado ainda.</p>
          </div>
        )}

        <div className="h-4"/>
      </div>
    </Layout>
  )
}
