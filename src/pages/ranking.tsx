import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Score, Player, getPresence } from '@/lib/supabase'
import TeamFormPopup from '@/components/TeamFormPopup'
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

function MovementArrow({ current, prev }: { current?: number; prev?: number }) {
  if (!current || !prev || current === prev) return null
  const diff = prev - current // positive = moved up (smaller number = higher rank)
  const up = diff > 0
  return (
    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${up ? 'text-green-500' : 'text-red-400'}`}>
      {up ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      )}
      {Math.abs(diff)}
    </span>
  )
}

function PicksBar({ count, total, dark = false }: { count: number; total: number; dark?: boolean }) {
  if (!total) return null
  const pct = Math.min(Math.round((count/total)*100), 100)
  const textCls = dark ? 'text-white/80' : 'text-[#0099CC]/75'
  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] ${textCls} flex items-center gap-1`}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          Palpites feitos
        </span>
        <span className={`text-[10px] ${textCls} font-semibold`}>{count} de {total} jogos</span>
      </div>
      <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#0099CC]" style={{ width:`${pct}%` }}/>
      </div>
    </div>
  )
}

function Medal({ pos }: { pos: number }) {
  if (pos === 1) return <svg width="26" height="26" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="26" r="11" fill="#FFF8E1" stroke="#B8860B" strokeWidth="1.5"/><path d="M13 14 11 7l9 3 9-3-2 7" fill="#FFD700" stroke="#B8860B" strokeWidth="1.2" strokeLinejoin="round"/><text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7a5800" fontFamily="sans-serif">1</text></svg>
  if (pos === 2) return <svg width="26" height="26" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="26" r="11" fill="#F5F5F5" stroke="#6C757D" strokeWidth="1.5"/><path d="M13 14 11 7l9 3 9-3-2 7" fill="#CED4DA" stroke="#6C757D" strokeWidth="1.2" strokeLinejoin="round"/><text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#495057" fontFamily="sans-serif">2</text></svg>
  if (pos === 3) return <svg width="26" height="26" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="26" r="11" fill="#FFF0E6" stroke="#A0522D" strokeWidth="1.5"/><path d="M13 14 11 7l9 3 9-3-2 7" fill="#E8A87C" stroke="#A0522D" strokeWidth="1.2" strokeLinejoin="round"/><text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7B3F00" fontFamily="sans-serif">3</text></svg>
  return <span className="text-[13px] font-bold text-gray-600 w-[26px] text-center block">{pos}º</span>
}

type BadgeMap = Record<string, string[]>
type FeedEvent = {
  id: string; type: string; player_name: string
  match_desc?: string; points?: number; factor?: string
  badge_key?: string; created_at: string
}

type Highlights = {
  topDay:       { player_name: string; pts_today: number; games_today: number } | null
  exactScorers: { match_desc: string; score_desc: string; players: { name: string; initials: string }[] } | null
  hotStreak:    { player_name: string; streak: number } | null
}

const BADGE_META: Record<string, { label: string; icon: string; color: string }> = {
  placar_perfeito:   { label: 'Placar Perfeito',   icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',          color: 'bg-green-100 text-green-800 border-green-200' },
  atirador_de_elite: { label: 'Atirador de Elite', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  vidente:           { label: 'Vidente',            icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  zebra:             { label: 'Zebra',              icon: 'M13 10V3L4 14h7v7l9-11h-7z',                              color: 'bg-pink-100 text-pink-800 border-pink-200' },
  maratonista:       { label: 'Maratonista',        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  lider:             { label: 'Lider',              icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
}

function BadgeChip({ badgeKey }: { badgeKey: string }) {
  const meta = BADGE_META[badgeKey]
  if (!meta) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d={meta.icon}/>
      </svg>
      {meta.label}
    </span>
  )
}

export default function RankingPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [ranking,      setRanking]      = useState<RankEntry[]>([])
  const [lastUpdate,   setLastUpdate]   = useState<string>('')
  const [fetching,     setFetching]     = useState(true)
  const [expanded,     setExpanded]     = useState<string|null>(null)
  const [showAll,      setShowAll]      = useState(false)
  const [totalMatches, setTotalMatches] = useState(72)
  const [badges,       setBadges]       = useState<BadgeMap>({})
  const [feed,         setFeed]         = useState<FeedEvent[]>([])
  const [highlights,   setHighlights]   = useState<Highlights>({ topDay: null, exactScorers: null, hotStreak: null })
  const [activeTab,    setActiveTab]    = useState<'ranking'|'feed'>('ranking')
  const meRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  // Fetch highlights when Feed tab opens
  useEffect(() => {
    if (activeTab !== 'feed') return
    fetch('/api/highlights')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setHighlights(data) })
      .catch(() => {})
  }, [activeTab])

  useEffect(() => {
    if (!player) return
    load()
    const ch = supabase.channel('scores-rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'scores' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [player])

  async function load() {
    const [{ data: scores }, { data: players }, { data: champs }, { count }, { data: badgeRows }, { data: feedRows }] = await Promise.all([
      supabase.from('scores').select('*').order('total_pts', { ascending: false }),
      supabase.from('players').select('*'),
      supabase.from('champion_picks').select('*'),
      supabase.from('matches').select('*', { count:'exact', head:true }),
      supabase.from('player_badges').select('player_id, badge_key'),
      supabase.from('activity_feed').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    if (!scores || !players) { setFetching(false); return }

    setTotalMatches(count || 72)

    // Badge map
    const bm: BadgeMap = {}
    ;(badgeRows || []).forEach((b: { player_id: string; badge_key: string }) => {
      if (!bm[b.player_id]) bm[b.player_id] = []
      bm[b.player_id].push(b.badge_key)
    })
    setBadges(bm)
    setFeed((feedRows || []) as FeedEvent[])

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
      .filter((e:any) => e.player && !e.player.is_admin && e.player.payment_ok)
      .sort((a:any, b:any) => {
        // Use stable rank_position if available, otherwise sort by pts
        if (a.rank_position && b.rank_position) return a.rank_position - b.rank_position
        if (b.total_pts !== a.total_pts) return b.total_pts - a.total_pts
        if (b.f10_count !== a.f10_count) return b.f10_count - a.f10_count
        if (b.f7_count  !== a.f7_count)  return b.f7_count  - a.f7_count
        if (b.f5_count  !== a.f5_count)  return b.f5_count  - a.f5_count
        return 0
      })

    setRanking(sorted)
    // Find most recent score update time
    const latestUpdate = (scores || [])
      .map((s: { updated_at?: string }) => s.updated_at)
      .filter(Boolean)
      .sort()
      .reverse()[0]
    if (latestUpdate) {
      setLastUpdate(new Date(latestUpdate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }))
    }
    setFetching(false)
  }

  const me         = ranking.find(r => r.player_id === player?.id)
  const myPos      = ranking.findIndex(r => r.player_id === player?.id) + 1
  const list       = showAll ? ranking : ranking.slice(0, 10)
  const onlineCount = ranking.filter(r => getPresence(r.player.last_seen_at).status === 'online').length

  function scrollToMe() {
    if (myPos > 10 && !showAll) {
      setShowAll(true)
      setTimeout(() => {
        meRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    } else {
      meRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

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
              {/* Avatar — clicável → Desempenho */}
              <div className="relative flex-shrink-0">
                <button onClick={() => router.push('/profile-setup?tab=desempenho')}
                  className="block active:scale-95 transition-transform"
                  title="Ver meu desempenho">
                  {getAvatarUrl(me.player)
                    ? <img src={getAvatarUrl(me.player)!} alt=""
                        className="w-16 h-16 rounded-full object-cover"
                        style={{ border:'3px solid rgba(255,255,255,0.9)' }}/>
                    : <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-xl font-bold text-[#0099CC]"
                        style={{ border:'3px solid rgba(255,255,255,0.9)' }}>
                        {initials(me.player.nickname || me.player.username)}
                      </div>
                  }
                  {/* Badge indicador — ícone de gráfico */}
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0099CC] border-2 border-white flex items-center justify-center shadow-sm">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                      <line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                  </span>
                </button>
                <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-[#FFD700] border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#7a5800]">
                  {myPos}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-[17px] truncate uppercase">
                  {me.player.nickname || me.player.username}
                </p>
                <p className="text-white/70 text-[11px] mt-0.5 font-medium">
                  10pts: {me.f10_count} | 7pts: {me.f7_count} | 5pts: {me.f5_count} | 2pts: {me.f2_count}
                  {me.champion_pts > 0 && ` · Bônus:+${me.champion_pts}`}
                </p>
                {/* Champion picks */}
                {me.champ && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-white/90 text-[10px]">Palpites:</span>
                    {[me.champ.pick_champion, me.champ.pick_runner, me.champ.pick_third].map((t,i) => (
                      <span key={i}><TeamFormPopup team={t} size={20}/></span>
                    ))}
                  </div>
                )}
                <PicksBar dark count={me.picks_count||0} total={totalMatches}/>
              </div>

              {/* Points + position */}
              <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-white font-bold text-[28px] leading-none">{me.total_pts}</p>
                  <p className="text-white/60 text-[10px]">pts</p>
                </div>
                <button
                  onClick={scrollToMe}
                  className="rounded-lg px-2.5 py-1.5 flex items-center gap-1 bg-white transition-transform active:translate-y-0.5"
                  style={{ boxShadow: '0 3px 0 rgba(0,0,0,0.28)' }}>
                  <span className="text-gray-400 text-[10px]">colocação</span>
                  <span className="text-[#0099CC] font-bold text-[13px]">{myPos}º</span>
                </button>
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

        {/* Tabs: Ranking | Feed */}
        <div className="flex bg-gray-100 rounded-xl p-1 mx-4 my-3">
          {(['ranking', 'feed'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5
                ${activeTab === t ? 'bg-white text-[#0099CC] shadow-sm' : 'text-gray-400'}`}>
              {t === 'ranking' ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>Ranking</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>Feed {feed.length > 0 && <span className="bg-[#0099CC] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{feed.length}</span>}</>
              )}
            </button>
          ))}
        </div>

        {/* ── FEED ── */}
        {activeTab === 'feed' && (
          <div className="px-4 pb-6 space-y-2">

            {/* ── Destaques do dia ── */}
            {(highlights.topDay || highlights.exactScorers || highlights.hotStreak) && (
              <div className="mb-1">
                <div className="flex items-center justify-between py-2">
                  <span className="text-[11px] font-semibold text-gray-500">Destaques do dia</span>
                </div>
                <div className="space-y-2">

                  {/* Maior pontuação do dia */}
                  {highlights.topDay && (
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3"
                      style={{borderLeft:'3px solid #BA7517', borderRadius:'0 1rem 1rem 0'}}>
                      <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Maior pontuação do dia</span>
                        <p className="text-[13px] font-semibold text-gray-800 mt-1 truncate">{highlights.topDay.player_name}</p>
                        <p className="text-[11px] text-gray-400">marcou <span className="font-bold text-amber-700">+{highlights.topDay.pts_today} pts</span> em {highlights.topDay.games_today} jogo{highlights.topDay.games_today !== 1 ? 's' : ''} hoje</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[24px] font-bold text-amber-600 leading-none">{highlights.topDay.pts_today}</p>
                        <p className="text-[10px] text-gray-400">pts hoje</p>
                      </div>
                    </div>
                  )}

                  {/* Placares exatos */}
                  {highlights.exactScorers && highlights.exactScorers.players.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-start gap-3"
                      style={{borderLeft:'3px solid #0F6E56', borderRadius:'0 1rem 1rem 0'}}>
                      <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Placares exatos</span>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {highlights.exactScorers.match_desc} · <span className="font-bold">{highlights.exactScorers.score_desc}</span>
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {highlights.exactScorers.players.map((p, i) => (
                            <div key={i} className="w-7 h-7 rounded-full bg-[#0099CC] flex items-center justify-center text-white text-[9px] font-bold" title={p.name}>
                              {p.initials}
                            </div>
                          ))}
                          {highlights.exactScorers.players.length > 8 && (
                            <span className="text-[10px] text-gray-400">+{highlights.exactScorers.players.length - 8}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sequência em alta */}
                  {highlights.hotStreak && (
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3"
                      style={{borderLeft:'3px solid #185FA5', borderRadius:'0 1rem 1rem 0'}}>
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Sequência em alta</span>
                        <p className="text-[13px] font-semibold text-gray-800 mt-1 truncate">{highlights.hotStreak.player_name}</p>
                        <p className="text-[11px] text-gray-400"><span className="font-bold text-blue-700">{highlights.hotStreak.streak} acertos</span> consecutivos</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {Array.from({length: Math.min(highlights.hotStreak.streak, 5)}).map((_, i) => (
                          <div key={i} className="w-2 h-7 bg-[#378ADD] rounded-sm opacity-80"/>
                        ))}
                        <div className="w-2 h-7 bg-blue-100 rounded-sm"/>
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-100 mt-3 mb-1 pt-2">
                  <span className="text-[11px] text-gray-400">Atividade recente</span>
                </div>
              </div>
            )}
            {feed.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3 opacity-40">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p className="text-[13px]">Nenhuma atividade ainda</p>
              </div>
            ) : feed.map(event => (
              <div key={event.id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-sm">
                {/* Icon by type */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  event.type === 'badge_earned'      ? 'bg-amber-100' :
                  event.type === 'payment_confirmed' ? 'bg-green-100' :
                  event.type === 'ranking_change'    ? 'bg-blue-100'  : 'bg-gray-100'
                }`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className={
                      event.type === 'badge_earned'      ? 'text-amber-600' :
                      event.type === 'payment_confirmed' ? 'text-green-600' :
                      event.type === 'ranking_change'    ? 'text-blue-600'  : 'text-gray-500'
                    }>
                    {event.type === 'badge_earned' && <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>}
                    {event.type === 'payment_confirmed' && <polyline points="20 6 9 17 4 12"/>}
                    {event.type === 'pick_saved' && <><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/><path d="M2 12h20"/></>}
                    {event.type === 'ranking_change' && <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-800 leading-snug">
                    <strong>{event.player_name}</strong>
                    {event.type === 'badge_earned' && event.badge_key && (
                      <> conquistou <span className="font-semibold text-amber-700">{BADGE_META[event.badge_key]?.label || event.badge_key}</span></>
                    )}
                    {event.type === 'payment_confirmed' && <> confirmou o pagamento</>}
                    {event.type === 'pick_saved' && event.match_desc && (
                      <> palpitou em <span className="text-gray-600">{event.match_desc}</span>{event.points !== undefined && <> · <span className="font-bold text-[#0099CC]">+{event.points}pts</span></>}</>
                    )}
                    {event.type === 'ranking_change' && <> subiu no ranking</>}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(event.created_at).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ranking' && (<>
        {/* List header */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <p className="text-[12px] text-gray-500 font-semibold">{ranking.length} participante{ranking.length !== 1 ? 's' : ''}</p>
            {onlineCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"/>
                {onlineCount} online agora
              </span>
            )}
          </div>
          {lastUpdate && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Atualizado {lastUpdate}
            </span>
          )}
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
              <div key={entry.player_id} ref={isMe ? meRowRef : undefined}>
                {/* Row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : entry.player_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50
                    ${isMe ? 'bg-[#e6f4fa]' : i===0?'bg-amber-50/60':i===1?'bg-gray-50/80':i===2?'bg-orange-50/40':''}
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
                    </div>
                    <p className="text-[10px] mt-0.5 font-bold flex items-center gap-1 flex-wrap">
                      <span style={{color:'#15803D'}}>10pts: {entry.f10_count}</span>
                      <span className="text-gray-300">|</span>
                      <span style={{color:'#1D4ED8'}}>7pts: {entry.f7_count}</span>
                      <span className="text-gray-300">|</span>
                      <span style={{color:'#16A34A'}}>5pts: {entry.f5_count}</span>
                      <span className="text-gray-300">|</span>
                      <span style={{color:'#B45309'}}>2pts: {entry.f2_count}</span>
                    </p>
                    <PicksBar count={entry.picks_count||0} total={totalMatches}/>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Movement arrow */}
                    <MovementArrow current={entry.rank_position} prev={entry.prev_position}/>
                    {/* Points */}
                    <div className="flex flex-col items-center">
                      <p className="font-bold text-[20px] leading-none text-gray-900">{entry.total_pts}</p>
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
                  <div className="bg-gray-50 border-b border-gray-100 px-4 py-4">

                    {/* ── Modelo A: barras + campeões lateral ── */}
                    <div className="flex gap-3">
                      {/* Barras de pontuação */}
                      <div className="flex-1 space-y-2">
                        {(() => {
                          const rows = [
                            { k:'f10_count', l:'Acertou tudo',  color:'#15803D', pts: 10 },
                            { k:'f7_count',  l:'Venc.+1 gol',  color:'#1D4ED8', pts: 7  },
                            { k:'f5_count',  l:'Vencedor',      color:'#15803D', pts: 5  },
                            { k:'f2_count',  l:'1 gol certo',   color:'#B45309', pts: 2  },
                            { k:'f0_count',  l:'Nenhum',        color:'#9CA3AF', pts: 0  },
                          ]
                          const maxVal = Math.max(...rows.map(r => (entry as any)[r.k] || 0), 1)
                          return rows.map(({ k, l, color, pts }) => {
                            const count = (entry as any)[k] || 0
                            const pct   = Math.round((count / maxVal) * 100)
                            const total = count * pts
                            return (
                              <div key={k} className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold w-[74px] flex-shrink-0"
                                  style={{ color }}>{l}</span>
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${pct}%`, background: color }}/>
                                </div>
                                <span className="text-[12px] font-bold text-gray-800 w-3.5 text-right flex-shrink-0">{count}</span>
                                <span className="text-[10px] text-gray-400 w-8 text-right flex-shrink-0">
                                  {total > 0 ? `${total}pts` : '—'}
                                </span>
                              </div>
                            )
                          })
                        })()}
                        {entry.champion_pts > 0 && (
                          <p className="text-[10px] text-amber-600 font-medium pt-0.5">
                            + {entry.champion_pts} pts bônus campeão
                          </p>
                        )}
                      </div>

                      {/* Divisor */}
                      {entry.champ && (
                        <>
                          <div className="w-px bg-gray-200 flex-shrink-0"/>
                          {/* Campeões */}
                          <div className="flex flex-col justify-center gap-2 min-w-[80px]">
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Campeões</p>
                            {[
                              { pos: '1°', team: entry.champ.pick_champion },
                              { pos: '2°', team: entry.champ.pick_runner   },
                              { pos: '3°', team: entry.champ.pick_third    },
                            ].map(({ pos, team }) => (
                              <div key={pos} className="flex items-center gap-1.5">
                                <TeamFormPopup team={team} size={18}/>
                                <span className="text-[11px] text-gray-700 truncate">{team}</span>
                                <span className="text-[9px] text-gray-400 flex-shrink-0">{pos}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Badges */}
                    {(badges[entry.player_id] || []).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Conquistas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(badges[entry.player_id] || []).map(key => (
                            <BadgeChip key={key} badgeKey={key}/>
                          ))}
                        </div>
                      </div>
                    )}
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
        </>)}
      </div>
    </Layout>
  )
}
