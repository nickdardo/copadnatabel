import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import FlagImg from '@/components/FlagImg'
import type { Match } from '@/lib/supabase'

const CAZETV_URL = 'https://www.youtube.com/@CazeTV/streams'

type ChatMsg = {
  id: string
  player_id: string
  player_name: string
  player_avatar?: string
  message: string
  created_at: string
}

// Mapa player_id → rank_position e total_pts para exibir no chat
type RankMap = Record<string, { rank: number; pts: number }>

// Extrai o video ID do YouTube de qualquer formato de link:
// https://youtu.be/VIDEO_ID
// https://www.youtube.com/watch?v=VIDEO_ID
// https://www.youtube.com/live/VIDEO_ID
// https://www.youtube.com/embed/VIDEO_ID
function extractYouTubeId(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0]
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v')
      const parts = u.pathname.split('/')
      const liveIdx = parts.indexOf('live')
      if (liveIdx !== -1 && parts[liveIdx + 1]) return parts[liveIdx + 1]
      const embedIdx = parts.indexOf('embed')
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1]
    }
  } catch { /* URL inválida */ }
  return null
}

function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const COLORS = ['#993C1D','#185FA5','#534AB7','#0F6E56','#854F0B','#A32D2D','#3B6D11']
  const color = COLORS[name.charCodeAt(0) % COLORS.length]
  if (avatar) return (
    <img src={avatar} alt={name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}/>
  )
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: size * 0.3, fontWeight: 500, color: '#fff',
    }}>{initials}</div>
  )
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

// Cor representativa de cada seleção (usada no fundo translúcido do placar).
// Fallback para azul neutro se a seleção não estiver mapeada.
const TEAM_COLORS: Record<string, string> = {
  'Brasil': '#FFDF00', 'Argentina': '#75AADB', 'França': '#002395', 'Inglaterra': '#CF081F',
  'Espanha': '#AA151B', 'Portugal': '#006600', 'Alemanha': '#000000', 'Países Baixos': '#FF6200',
  'Croácia': '#FF0000', 'Bélgica': '#FDDA24', 'Uruguai': '#5CBFEB', 'Colômbia': '#FCD116',
  'México': '#006847', 'Canadá': '#FF0000', 'Qatar': '#8A1538', 'Marrocos': '#C1272D',
  'Japão': '#BC002D', 'Coreia do Sul': '#003478', 'Estados Unidos': '#3C3B6E', 'Suíça': '#FF0000',
  'Senegal': '#00853F', 'Equador': '#FFD100', 'Gana': '#006B3F', 'Nigéria': '#008751',
  'Camarões': '#007A5E', 'Austrália': '#00843D', 'Dinamarca': '#C60C30', 'Sérvia': '#C6363C',
  'Polônia': '#DC143C', 'Áustria': '#ED2939', 'Tchéquia': '#11457E', 'África do Sul': '#007A4D',
}

function teamColor(team: string): string {
  return TEAM_COLORS[team] || '#185FA5'
}

// Card de placar com tema escuro e cores das duas seleções translúcidas ao fundo.
function LiveScoreCard({ match, big }: { match: Match; big?: boolean }) {
  const homeColor = teamColor(match.home_team)
  const awayColor = teamColor(match.away_team)
  const scoreSize = big ? 'text-[44px]' : 'text-[34px]'
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: '#0a2540' }}>
      {/* Cores das seleções translúcidas */}
      <div className="absolute top-0 left-0 h-full" style={{ width: '50%', background: homeColor, opacity: 0.16 }}/>
      <div className="absolute top-0 right-0 h-full" style={{ width: '50%', background: awayColor, opacity: 0.16 }}/>
      <div className="relative px-5 py-4">
        <div className="flex justify-center mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: 'rgba(239,68,68,0.9)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>
            <span className="text-[10px] text-white font-bold tracking-wide">AO VIVO</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-center flex-1">
            <FlagImg team={match.home_team} size={big ? 40 : 30}/>
            <p className="text-[11px] text-white/80 mt-1.5 mb-1">{match.home_team}</p>
            <p className={`${scoreSize} font-bold text-white leading-none`}>{match.score_home ?? '—'}</p>
          </div>
          <p className="text-[18px] text-white/40 font-light flex-shrink-0">×</p>
          <div className="text-center flex-1">
            <FlagImg team={match.away_team} size={big ? 40 : 30}/>
            <p className="text-[11px] text-white/80 mt-1.5 mb-1">{match.away_team}</p>
            <p className={`${scoreSize} font-bold text-white leading-none`}>{match.score_away ?? '—'}</p>
          </div>
        </div>
        {big && <p className="text-[11px] text-white/40 mt-2 text-center">{match.fase}</p>}
      </div>
    </div>
  )
}

// Thumbnail clicável que abre o YouTube — funciona sempre,
// ao contrário do iframe que a CazéTV bloqueia por política do canal.
function YouTubePlayer({ videoId, streamUrl }: { videoId: string; streamUrl: string }) {
  const thumb = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  return (
    <a href={streamUrl} target="_blank" rel="noopener noreferrer"
      className="block relative rounded-2xl overflow-hidden"
      style={{ paddingTop: '56.25%' }}>
      <img
        src={thumb}
        alt="Transmissão ao vivo"
        onError={e => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {/* Overlay escuro + botão play */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'rgba(255,0,0,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>Assistir na CazéTV</span>
      </div>
      {/* Badge ao vivo */}
      <div style={{
        position: 'absolute', top: 12, left: 12,
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'rgba(0,0,0,0.65)', borderRadius: 999,
        padding: '4px 10px',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f87171', display: 'inline-block' }}/>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>AO VIVO</span>
      </div>
    </a>
  )
}

export default function WatchPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [messages,    setMessages]    = useState<ChatMsg[]>([])
  const [rankMap,     setRankMap]     = useState<RankMap>({})
  const [input,       setInput]       = useState('')
  const [sending,     setSending]     = useState(false)
  const [sendError,   setSendError]   = useState<string|null>(null)
  const [onlineCount, setOnlineCount] = useState(1)
  const [fetching,    setFetching]    = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)

  async function reloadMessages() {
    const { data } = await supabase.from('chat_messages')
      .select('id, player_id, player_name, player_avatar, message, created_at')
      .order('created_at', { ascending: true }).limit(100)
    if (data) setMessages(data as ChatMsg[])
  }

  useEffect(() => {
    if (!loading && !player) router.push('/')
  }, [loading, player])

  useEffect(() => {
    if (!player) return

    async function load() {
      setFetching(true)
      const [{ data: matches }, { data: msgs }, { data: scores }] = await Promise.all([
        supabase.from('matches').select('*').eq('status', 'live').order('match_date'),
        supabase.from('chat_messages')
          .select('id, player_id, player_name, player_avatar, message, created_at')
          .order('created_at', { ascending: true })
          .limit(100),
        supabase.from('scores').select('player_id, rank_position, total_pts'),
      ])
      setLiveMatches((matches || []) as Match[])
      setMessages((msgs || []) as ChatMsg[])
      const rm: RankMap = {}
      ;(scores || []).forEach((s: { player_id: string; rank_position: number; total_pts: number }) => {
        if (s.rank_position) rm[s.player_id] = { rank: s.rank_position, pts: s.total_pts || 0 }
      })
      setRankMap(rm)
      setFetching(false)
    }
    load()

    const chatSub = supabase.channel('watch-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        payload => setMessages(prev => {
          const m = payload.new as ChatMsg
          if (prev.some(x => x.id === m.id)) return prev // evita duplicar
          return [...prev, m]
        }))
      .subscribe()

    const matchSub = supabase.channel('watch-matches')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' },
        () => supabase.from('matches').select('*').eq('status', 'live').order('match_date')
          .then(({ data }) => setLiveMatches((data || []) as Match[])))
      .subscribe()

    // Presença: marca este jogador como ativo na tela Assistir e conta quantos estão
    async function pingPresence() {
      try {
        await supabase.from('watch_presence').upsert({
          player_id: player!.id,
          last_seen: new Date().toISOString(),
        }, { onConflict: 'player_id' })
        const since = new Date(Date.now() - 30_000).toISOString()
        const { count } = await supabase.from('watch_presence')
          .select('player_id', { count: 'exact', head: true })
          .gte('last_seen', since)
        setOnlineCount(count ?? 1)
      } catch { /* presença é secundária, não trava o chat */ }
    }
    pingPresence()

    // Polling de fallback: recarrega mensagens + presença a cada 4s
    // (garante atualização mesmo se o Realtime do Supabase não disparar)
    const poll = setInterval(() => {
      reloadMessages()
      pingPresence()
    }, 4000)

    return () => {
      supabase.removeChannel(chatSub)
      supabase.removeChannel(matchSub)
      clearInterval(poll)
    }
  }, [player])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!player || !input.trim() || sending) return
    const msg = input.trim()
    setInput('')
    setSending(true)
    setSendError(null)
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: player.id,
        player_name: player.nickname || player.username,
        player_avatar: player.avatar_url || null,
        message: msg,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setSendError(`Erro: ${json.error || 'falha ao enviar'}`)
      setInput(msg)
    } else {
      // Fallback: recarrega caso Realtime não dispare
      setTimeout(reloadMessages, 800)
    }
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (loading || !player) return null

  const hasLive = liveMatches.length > 0
  // Usa o primeiro jogo com stream_url configurado, ou o primeiro ao vivo
  const primaryMatch = liveMatches.find(m => m.stream_url) || liveMatches[0]
  const videoId = primaryMatch?.stream_url ? extractYouTubeId(primaryMatch.stream_url) : null

  return (
    <Layout title="Assistir">
      <div className="max-w-lg mx-auto pb-4">

        {/* Player ou placar */}
        {hasLive ? (
          <div className="mx-4 mt-4">
            {videoId ? (
              <div>
                <YouTubePlayer videoId={videoId} streamUrl={primaryMatch!.stream_url!}/>
                {/* Placar abaixo do player */}
                <div className="mt-2">
                  <LiveScoreCard match={primaryMatch!}/>
                </div>
                {/* Se há mais jogos ao vivo além do principal */}
                {liveMatches.filter(m => m.id !== primaryMatch?.id).map(m => (
                  <div key={m.id} className="mt-2 bg-gray-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[12px] text-gray-700">{m.home_team}</span>
                    <span className="text-[13px] font-bold text-gray-900">{m.score_home ?? '?'} × {m.score_away ?? '?'}</span>
                    <span className="text-[12px] text-gray-700">{m.away_team}</span>
                  </div>
                ))}
              </div>
            ) : (
              /* Sem stream_url configurado — placar grande + botão CazéTV */
              <div>
                {liveMatches.map(m => (
                  <div key={m.id} className="mb-2">
                    <LiveScoreCard match={m} big/>
                  </div>
                ))}
                <a href={CAZETV_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#0099CC] hover:bg-[#007aa8] transition-colors rounded-2xl py-3.5 w-full text-white font-semibold text-[14px]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                  Assistir ao vivo na CazéTV
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-4 mt-4 bg-gray-50 border border-gray-100 rounded-2xl px-5 py-6 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3">
              <rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/>
            </svg>
            <p className="text-[14px] font-semibold text-gray-700 mb-1">Nenhum jogo ao vivo agora</p>
            <p className="text-[12px] text-gray-400 mb-4">Quando uma partida começar, o placar aparece aqui.</p>
            <a href={CAZETV_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#0099CC] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#007aa8] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
              Abrir CazéTV no YouTube
            </a>
          </div>
        )}

        {/* Chat */}
        <div className="mx-4 mt-4 bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-[13px] font-bold text-gray-900">Chat do bolão</p>
            <span className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 animate-pulse"/>
              {onlineCount} online
            </span>
          </div>

          <div className="px-4 py-3 space-y-3" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {fetching && (
              <div className="flex justify-center py-4">
                <span className="w-5 h-5 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
              </div>
            )}
            {!fetching && messages.length === 0 && (
              <p className="text-[12px] text-gray-400 text-center py-4">Nenhuma mensagem ainda. Seja o primeiro!</p>
            )}
            {messages.map(msg => {
              const isMe = msg.player_id === player.id
              const info = rankMap[msg.player_id]
              const rankLabel = info
                ? info.rank === 1 ? '🥇 1º'
                : info.rank === 2 ? '🥈 2º'
                : info.rank === 3 ? '🥉 3º'
                : `${info.rank}º`
                : null
              return (
                <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && <Avatar name={msg.player_name} avatar={msg.player_avatar} size={30}/>}
                  <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-0.5 ml-1">
                        <span className="text-[10px] text-gray-500 font-semibold">{msg.player_name}</span>
                        {rankLabel && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 leading-none">
                            {rankLabel} · {info!.pts}pts
                          </span>
                        )}
                      </div>
                    )}
                    {isMe && rankLabel && (
                      <div className="flex items-center justify-end gap-1 mb-0.5 mr-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#0099CC]/10 text-[#0099CC] leading-none">
                          {rankLabel} · {info!.pts}pts
                        </span>
                      </div>
                    )}
                    <div className={`px-3 py-2 rounded-2xl text-[13px] ${
                      isMe ? 'bg-[#0099CC] text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                    }`}>
                      {msg.message}
                    </div>
                    <span className="text-[10px] text-gray-300 mt-0.5 mx-1">{fmtTime(msg.created_at)}</span>
                  </div>
                </div>
              )
            })}
            <div ref={chatEndRef}/>
          </div>

          <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
            <input
              value={input}
              onChange={e => { setInput(e.target.value); setSendError(null) }}
              onKeyDown={handleKey}
              placeholder="mensagem..."
              maxLength={280}
              className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#0099CC]/30 border-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-xl bg-[#0099CC] flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95 flex-shrink-0">
              {sending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
              }
            </button>
          </div>
          {sendError && (
            <p className="text-[11px] text-red-500 px-4 pb-3">{sendError}</p>
          )}
        </div>

      </div>
    </Layout>
  )
}
