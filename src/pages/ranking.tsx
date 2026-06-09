import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Score, Player } from '@/lib/supabase'
import { getFlag } from '@/lib/flags'
import FlagImg from '@/components/FlagImg'
import Layout from '@/components/Layout'

type ChampPick = { pick_champion: string; pick_runner: string; pick_third: string }
type RankEntry  = Score & { player: Player; champ?: ChampPick }

const COLORS = ['#0099CC','#1565C0','#7B1FA2','#C62828','#2E7D32','#F57F17','#00838F','#4527A0']

function initials(n: string) {
  return (n || '?').split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
}

function resolveAvatar(p: Player): string | null {
  if (!p?.avatar_url) return null
  try {
    if (p.avatar_url.startsWith('http')) return p.avatar_url
    const { data } = supabase.storage.from('avatars').getPublicUrl(p.avatar_url)
    return data?.publicUrl || null
  } catch { return null }
}

function PicksBar({ count, total }: { count: number; total: number }) {
  if (!total) return null
  const pct = Math.min(Math.round((count / total) * 100), 100)
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#0099CC]/50 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{count}/{total}</span>
    </div>
  )
}

// Medal SVG
function Medal({ pos }: { pos: number }) {
  if (pos === 1) return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="26" r="11" fill="#FFF8E1" stroke="#B8860B" strokeWidth="1.5"/>
      <path d="M13 14 11 7l9 3 9-3-2 7" fill="#FFD700" stroke="#B8860B" strokeWidth="1.2" strokeLinejoin="round"/>
      <text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7a5800" fontFamily="sans-serif">1</text>
    </svg>
  )
  if (pos === 2) return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="26" r="11" fill="#F5F5F5" stroke="#6C757D" strokeWidth="1.5"/>
      <path d="M13 14 11 7l9 3 9-3-2 7" fill="#CED4DA" stroke="#6C757D" strokeWidth="1.2" strokeLinejoin="round"/>
      <text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#495057" fontFamily="sans-serif">2</text>
    </svg>
  )
  if (pos === 3) return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="26" r="11" fill="#FFF0E6" stroke="#A0522D" strokeWidth="1.5"/>
      <path d="M13 14 11 7l9 3 9-3-2 7" fill="#E8A87C" stroke="#A0522D" strokeWidth="1.2" strokeLinejoin="round"/>
      <text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7B3F00" fontFamily="sans-serif">3</text>
    </svg>
  )
  return <span className="text-[13px] font-bold text-gray-400">{pos}º</span>
}

export default function RankingPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [ranking,      setRanking]      = useState<RankEntry[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [lastUpdate,   setLastUpdate]   = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [showAll,      setShowAll]      = useState(false)
  const [totalMatches, setTotalMatches] = useState(104)

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  useEffect(() => {
    if (!player) return
    fetchRanking()
    const ch = supabase.channel('scores-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, fetchRanking)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [player])

  async function fetchRanking() {
    const [{ data: sd }, { data: champData }, { count: mCount }, { data: playersData }] = await Promise.all([
      supabase.from('scores').select('*').order('total_pts', { ascending: false }),
      supabase.from('champion_picks').select('*'),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*'),  // fresh player data with latest nickname/avatar
    ])
    if (!sd) { setFetching(false); return }
    setTotalMatches(mCount || 72)
    const champMap: Record<string, ChampPick> = {}
    ;(champData || []).forEach((c: any) => { champMap[c.player_id] = c })
    const playerMap: Record<string, any> = {}
    ;(playersData || []).forEach((p: any) => { playerMap[p.id] = p })
    const sorted = sd
      .map((d: any) => ({ ...d, player: playerMap[d.player_id] || {}, champ: champMap[d.player_id] }))
      .filter((d: any) => d.player && !d.player.is_admin)   // exclude admins
      .sort((a: any, b: any) => {
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
    setFetching(false)
  }

  const myEntry = ranking.find(r => r.player_id === player?.id)
  const myPos   = ranking.findIndex(r => r.player_id === player?.id) + 1

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  return (
    <Layout title="Ranking">
      <div className="max-w-lg mx-auto">

        {/* ── My hero banner ───────────────────────────────────────── */}
        {myEntry && (
          <div className="relative overflow-hidden mb-1"
            style={{ background: 'linear-gradient(135deg,#003a6e 0%,#0064a8 55%,#0099CC 100%)' }}>
            {/* Decorative rings */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[80,160,240,320].map(s => (
                <div key={s} className="absolute rounded-full border border-white/10"
                  style={{ width: s, height: s, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
              ))}
            </div>

            <div className="relative flex items-center gap-4 px-5 py-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {(() => { const av = resolveAvatar(myEntry.player); return av ? (
                  <img src={av} alt=""
                    className="w-16 h-16 rounded-full object-cover shadow-lg"
                    style={{ border: '3px solid rgba(255,255,255,0.9)' }} />
                ) : (
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-[#0099CC] bg-white shadow-lg"
                    style={{ border: '3px solid rgba(255,255,255,0.9)' }}>
                    {initials(myEntry.player.nickname || myEntry.player.username)}
                  </div>
                ); })()}
                <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-[#FFD700] border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#7a5800]">
                  {myPos}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-[18px] leading-tight truncate uppercase tracking-wide">
                  {myEntry.player.nickname || myEntry.player.username}
                </p>
                <p className="text-white/60 text-[11px] mt-0.5">
                  F10:{myEntry.f10_count} · F7:{myEntry.f7_count} · F5:{myEntry.f5_count} · F2:{myEntry.f2_count}
                  {myEntry.champion_pts > 0 && ` · Bônus:+${myEntry.champion_pts}`}
                </p>

                {/* Champion picks with flags */}
                {myEntry.champ && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-white/50 text-[10px]">Campeões:</span>
                    {[myEntry.champ.pick_champion, myEntry.champ.pick_runner, myEntry.champ.pick_third].map((team, i) => (
                      <div key={i} className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
                        <FlagImg team={team} size={18} />
                        <span className="text-white text-[10px] font-medium hidden sm:block">{team}</span>
                      </div>
                    ))}
                  </div>
                )}

                <PicksBar count={myEntry.picks_count || 0} total={totalMatches} />
              </div>

              {/* Points */}
              <div className="text-right flex-shrink-0">
                <p className="text-white font-bold text-[32px] leading-none">{myEntry.total_pts}</p>
                <p className="text-white/50 text-[11px]">pontos</p>
              </div>
            </div>

            {/* Payment status */}
            {myEntry.player.payment_ok ? (
              <div className="bg-green-500/20 border-t border-green-400/30 px-5 py-2 flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86EFAC" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="text-green-200 text-[11px] font-medium">Pagamento confirmado!</span>
              </div>
            ) : (
              <div className="bg-amber-500/20 border-t border-amber-400/30 px-5 py-2 flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="text-amber-200 text-[11px] font-medium">Pagamento pendente · R$10,00 para Aristone Figueredo</span>
              </div>
            )}
          </div>
        )}

        {/* ── List header ──────────────────────────────────────────── */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
          <p className="text-[12px] text-gray-500 font-semibold">{ranking.length} participante{ranking.length !== 1 ? 's' : ''}</p>
          {lastUpdate && (
            <p className="text-[11px] text-gray-300">
              Atualizado {new Date(lastUpdate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* ── Ranking rows ─────────────────────────────────────────── */}
        <div>
          {ranking.slice(0, showAll ? ranking.length : 10).map((entry, i) => {
            const isMe   = entry.player_id === player?.id
            const color  = COLORS[i % COLORS.length]
            const photo  = resolveAvatar(entry.player)
            const name   = entry.player.nickname || entry.player.username
            const isOpen = expanded === entry.player_id

            const rowBg =
              i === 0 ? 'bg-[#0099CC]/6' :
              i === 1 ? 'bg-[#0077b6]/4' :
              i === 2 ? 'bg-[#48cae4]/3' : ''

            return (
              <div key={entry.player_id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : entry.player_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 text-left transition-colors
                    hover:bg-gray-50/60 ${rowBg} ${isMe ? 'ring-inset ring-1 ring-[#0099CC]/20' : ''}`}>

                  {/* Position */}
                  <div className="w-8 flex items-center justify-center flex-shrink-0">
                    <Medal pos={i + 1} />
                  </div>

                  {/* Avatar */}
                  {photo ? (
                    <img src={photo} alt={name}
                      className="w-11 h-11 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm" />
                  ) : (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0 shadow-sm border-2 border-white"
                      style={{ background: color }}>
                      {initials(name)}
                    </div>
                  )}

                  {/* Name + stats */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[14px] text-gray-900 truncate">{name}</span>
                      {isMe && (
                        <span className="text-[10px] text-[#0099CC] font-semibold bg-[#0099CC]/10 px-1.5 py-0.5 rounded-full">você</span>
                      )}
                      {entry.player.payment_ok ? (
                        <span className="text-[9px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">pago</span>
                      ) : (
                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">pag. pendente</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      F10:{entry.f10_count} · F7:{entry.f7_count} · F5:{entry.f5_count} · F2:{entry.f2_count}
                    </p>
                    <PicksBar count={entry.picks_count || 0} total={totalMatches} />
                  </div>

                  {/* Points + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className={`font-bold text-[17px] leading-none ${i === 0 ? 'text-[#0099CC]' : 'text-gray-800'}`}>
                        {entry.total_pts}
                      </p>
                      <p className="text-[10px] text-gray-400">pts</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"
                      className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="bg-gray-50/80 border-b border-gray-100 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">

                      {/* Factor breakdown */}
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2.5">Pontuação</p>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { k: 'f10_count', l: 'F10', c: 'bg-green-100 text-green-800',  p: 10 },
                            { k: 'f7_count',  l: 'F7',  c: 'bg-blue-100 text-blue-800',    p: 7  },
                            { k: 'f5_count',  l: 'F5',  c: 'bg-amber-100 text-amber-800',  p: 5  },
                            { k: 'f2_count',  l: 'F2',  c: 'bg-pink-100 text-pink-800',    p: 2  },
                            { k: 'f0_count',  l: 'F0',  c: 'bg-gray-100 text-gray-600',    p: 0  },
                          ].map(({ k, l, c, p }) => (
                            <div key={k} className={`px-2.5 py-1.5 rounded-xl text-center ${c}`}>
                              <p className="text-[10px] font-semibold">{l}</p>
                              <p className="text-[14px] font-bold">{(entry as any)[k]}</p>
                              <p className="text-[9px] opacity-70">{(entry as any)[k] * p}pts</p>
                            </div>
                          ))}
                          {entry.champion_pts > 0 && (
                            <div className="px-2.5 py-1.5 rounded-xl text-center bg-amber-100 text-amber-800">
                              <p className="text-[10px] font-semibold">Bônus</p>
                              <p className="text-[14px] font-bold">+{entry.champion_pts}</p>
                              <p className="text-[9px] opacity-70">camp.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Champion picks */}
                      {entry.champ && (
                        <div className="text-right">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2.5">Palpites</p>
                          <div className="space-y-1.5">
                            {[
                              { label: '🥇', team: entry.champ.pick_champion },
                              { label: '🥈', team: entry.champ.pick_runner   },
                              { label: '🥉', team: entry.champ.pick_third    },
                            ].map(({ label, team }) => (
                              <div key={label} className="flex items-center gap-2 justify-end">
                                <span className="text-[12px] text-gray-500 font-medium">{team}</span>
                                <FlagImg team={team} size={22} />
                                <span className="text-[14px]">{label}</span>
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

        {/* Show more button */}
        {!showAll && ranking.length > 10 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-3 mt-2 rounded-2xl border border-gray-200 bg-white text-[13px] font-semibold text-[#0099CC] hover:bg-gray-50 transition-colors shadow-sm">
            Ver todos os {ranking.length} participantes
          </button>
        )}
        {showAll && ranking.length > 10 && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full py-3 mt-2 rounded-2xl border border-gray-200 bg-white text-[13px] font-semibold text-gray-400 hover:bg-gray-50 transition-colors">
            Mostrar menos
          </button>
        )}

        {/* Empty state */}
        {ranking.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.75" strokeLinecap="round">
                <path d="M6 9H4a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h2"/>
                <path d="M18 9h2a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1h-2"/>
                <path d="M8 21h8"/><path d="M12 17v4"/>
                <path d="M7 4v5a5 5 0 0 0 10 0V4H7Z"/>
              </svg>
            </div>
            <p className="text-[14px] text-gray-400 leading-relaxed">Nenhum resultado ainda.<br />Aguarde os jogos!</p>
          </div>
        )}

        <div className="h-4" />
      </div>
    </Layout>
  )
}
