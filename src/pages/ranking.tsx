import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Score, Player } from '@/lib/supabase'
import { getFlag } from '@/lib/flags'
import FlagImg from '@/components/FlagImg'
import Layout from '@/components/Layout'

type ChampPick = { pick_champion:string; pick_runner:string; pick_third:string }
type RankEntry  = Score & { player:Player; champ?:ChampPick; totalMatches?:number }

const COLORS = ['#0099CC','#1565C0','#7B1FA2','#C62828','#2E7D32','#F57F17','#00838F','#4527A0']

function initials(n:string){ return (n||'?').split(' ').filter(Boolean).map((w:string)=>w[0]).slice(0,2).join('').toUpperCase() }

function resolveAvatar(p:Player):string|null {
  if (!p.avatar_url) return null
  if (p.avatar_url.startsWith('http')) return p.avatar_url+'?v=1'
  const {data} = supabase.storage.from('avatars').getPublicUrl(p.avatar_url)
  return data.publicUrl+'?v=1'
}

// Progress bar for picks
function PicksBar({count,total}:{count:number;total:number}) {
  if (!total) return null
  const pct = Math.min(Math.round((count/total)*100),100)
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#0099CC]/50 transition-all" style={{width:`${pct}%`}}/>
      </div>
      <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{count}/{total}</span>
    </div>
  )
}

export default function RankingPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [ranking,      setRanking]      = useState<RankEntry[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [lastUpdate,   setLastUpdate]   = useState('')
  const [expanded,     setExpanded]     = useState<string|null>(null)
  const [totalMatches, setTotalMatches] = useState(0)

  useEffect(()=>{ if(!loading&&!player) router.push('/') },[loading,player])

  useEffect(()=>{ if(!player) return; fetchRanking()
    const ch = supabase.channel('scores-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'scores'},fetchRanking)
      .subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[player])

  async function fetchRanking() {
    const [{ data:sd },{ data:champData },{ data:mData }] = await Promise.all([
      supabase.from('scores').select('*, players(*)').order('total_pts',{ascending:false}),
      supabase.from('champion_picks').select('*'),
      supabase.from('matches').select('id',{count:'exact',head:true}),
    ])
    if (!sd) { setFetching(false); return }
    const total = (mData as any)?.length || 104
    setTotalMatches(total)
    const champMap: Record<string,ChampPick> = {}
    ;(champData||[]).forEach((c:any)=>{ champMap[c.player_id]=c })
    const sorted = sd.map((d:any)=>({...d,player:d.players,champ:champMap[d.player_id]}))
      .sort((a:any,b:any)=>{
        if(b.total_pts!==a.total_pts) return b.total_pts-a.total_pts
        if(b.f10_count!==a.f10_count) return b.f10_count-a.f10_count
        if(b.f7_count!==a.f7_count)  return b.f7_count-a.f7_count
        if(b.f5_count!==a.f5_count)  return b.f5_count-a.f5_count
        if(b.f2_count!==a.f2_count)  return b.f2_count-a.f2_count
        if(a.f0_count!==b.f0_count)  return a.f0_count-b.f0_count
        return new Date(a.players.created_at).getTime()-new Date(b.players.created_at).getTime()
      })
    setRanking(sorted)
    if(sorted[0]) setLastUpdate(sorted[0].updated_at)
    setFetching(false)
  }

  const myEntry = ranking.find(r=>r.player_id===player?.id)
  const myPos   = ranking.findIndex(r=>r.player_id===player?.id)+1

  if(loading||fetching) return <div className="min-h-screen flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/></div>

  return (
    <Layout title="Ranking">
      <div className="max-w-lg mx-auto">

        {/* Hero banner */}
        {myEntry&&(
          <div className="relative overflow-hidden mb-1" style={{background:'linear-gradient(135deg,#003a6e 0%,#0064a8 55%,#0099CC 100%)'}}>
            <div className="absolute inset-0 opacity-10">
              {[80,160,240,320].map(s=>(
                <div key={s} className="absolute rounded-full border border-white/30"
                  style={{width:s,height:s,top:'50%',left:'50%',transform:'translate(-50%,-50%)'}}/>
              ))}
            </div>
            <div className="relative flex items-center gap-4 px-5 py-5">
              <div className="relative flex-shrink-0">
                {resolveAvatar(myEntry.player)?(
                  <img src={resolveAvatar(myEntry.player)!} alt=""
                    className="w-16 h-16 rounded-full object-cover shadow-lg"
                    style={{border:'3px solid rgba(255,255,255,0.9)'}}/>
                ):(
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-[#0099CC] bg-white shadow-lg"
                    style={{border:'3px solid rgba(255,255,255,0.9)'}}>
                    {initials(myEntry.player.nickname||myEntry.player.username)}
                  </div>
                )}
                <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-[#FFD700] border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#7a5800]">{myPos}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-[18px] leading-tight truncate uppercase tracking-wide">
                  {(myEntry.player.nickname||myEntry.player.username)}
                </p>
                <p className="text-white/60 text-[11px] mt-0.5">
                  F10:{myEntry.f10_count} · F7:{myEntry.f7_count} · F5:{myEntry.f5_count} · F2:{myEntry.f2_count}
                  {myEntry.champion_pts>0&&` · Bônus:+${myEntry.champion_pts}`}
                </p>
                {myEntry.champ&&(
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-white/50 text-[10px]">Palpites:</span>
                    {[myEntry.champ.pick_champion,myEntry.champ.pick_runner,myEntry.champ.pick_third].map((t,i)=>(
                      <span key={i} className="text-[16px] leading-none">{getFlag(t)}</span>
                    ))}
                  </div>
                )}
                <PicksBar count={myEntry.picks_count||0} total={totalMatches}/>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white font-bold text-[32px] leading-none">{myEntry.total_pts}</p>
                <p className="text-white/50 text-[11px]">pontos</p>
              </div>
            </div>
            {!myEntry.player.payment_ok&&(
              <div className="bg-amber-500/20 border-t border-amber-400/30 px-5 py-2 flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="text-amber-200 text-[11px] font-medium">Pagamento pendente · R$10,00 para Aristone Figueredo</span>
              </div>
            )}
            {myEntry.player.payment_ok&&(
              <div className="bg-green-500/20 border-t border-green-400/30 px-5 py-2 flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86EFAC" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="text-green-200 text-[11px] font-medium">Pagamento confirmado!</span>
              </div>
            )}
          </div>
        )}

        {/* List header */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <p className="text-[12px] text-gray-400 font-medium">{ranking.length} participantes</p>
          {lastUpdate&&<p className="text-[11px] text-gray-300">Atualizado {new Date(lastUpdate).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>}
        </div>

        {/* Ranking rows */}
        <div>
          {ranking.map((entry,i)=>{
            const isMe    = entry.player_id===player?.id
            const color   = COLORS[i%COLORS.length]
            const photo   = resolveAvatar(entry.player)
            const name    = entry.player.nickname||entry.player.username
            const isOpen  = expanded===entry.player_id
            const rowBg   = i===0?'bg-[#0099CC]/8':i===1?'bg-[#0077b6]/5':i===2?'bg-[#48cae4]/4':''

            return (
              <div key={entry.player_id}>
                <button onClick={()=>setExpanded(isOpen?null:entry.player_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 transition-colors text-left hover:bg-gray-50/60 ${rowBg} ${isMe?'ring-inset ring-1 ring-[#0099CC]/20':''}`}>
                  {/* Position */}
                  <div className="w-8 text-center flex-shrink-0">
                    {i===0?<span className="text-[20px]">🥇</span>:i===1?<span className="text-[20px]">🥈</span>:i===2?<span className="text-[20px]">🥉</span>:<span className="text-[13px] font-bold text-gray-400">{i+1}º</span>}
                  </div>
                  {/* Photo */}
                  {photo?(
                    <img src={photo} alt={name} className="w-11 h-11 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm"/>
                  ):(
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0 shadow-sm border-2 border-white" style={{background:color}}>
                      {initials(name)}
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[14px] text-gray-900 truncate">{name}</span>
                      {isMe&&<span className="text-[10px] text-[#0099CC] font-semibold bg-[#0099CC]/10 px-1.5 py-0.5 rounded-full">você</span>}
                      {entry.player.payment_ok
                        ?<span className="text-[9px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">pago</span>
                        :<span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">pag. pendente</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">F10:{entry.f10_count} · F7:{entry.f7_count} · F5:{entry.f5_count} · F2:{entry.f2_count}</p>
                    <PicksBar count={entry.picks_count||0} total={totalMatches}/>
                  </div>
                  {/* Points */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className={`font-bold text-[17px] leading-none ${i===0?'text-[#0099CC]':'text-gray-800'}`}>{entry.total_pts}</p>
                      <p className="text-[10px] text-gray-400">pts</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${isOpen?'rotate-180':''}`}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </button>

                {/* Expanded */}
                {isOpen&&(
                  <div className="bg-gray-50 border-b border-gray-100 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Pontuação detalhada</p>
                        <div className="flex gap-2 flex-wrap">
                          {[{k:'f10_count',l:'F10',c:'bg-green-100 text-green-800',p:10},{k:'f7_count',l:'F7',c:'bg-blue-100 text-blue-800',p:7},{k:'f5_count',l:'F5',c:'bg-amber-100 text-amber-800',p:5},{k:'f2_count',l:'F2',c:'bg-pink-100 text-pink-800',p:2},{k:'f0_count',l:'F0',c:'bg-gray-100 text-gray-600',p:0}]
                            .map(({k,l,c,p})=>(
                            <div key={k} className={`px-2.5 py-1.5 rounded-xl text-center ${c}`}>
                              <p className="text-[10px] font-semibold">{l}</p>
                              <p className="text-[14px] font-bold">{(entry as any)[k]}</p>
                              <p className="text-[9px] opacity-70">{(entry as any)[k]*p}pts</p>
                            </div>
                          ))}
                          {entry.champion_pts>0&&(
                            <div className="px-2.5 py-1.5 rounded-xl text-center bg-amber-100 text-amber-800">
                              <p className="text-[10px] font-semibold">Bônus</p>
                              <p className="text-[14px] font-bold">+{entry.champion_pts}</p>
                              <p className="text-[9px] opacity-70">camp.</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {entry.champ&&(
                        <div className="text-right">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Campeões</p>
                          <div className="space-y-1">
                            {[
                              {label:'🥇',team:entry.champ.pick_champion},
                              {label:'🥈',team:entry.champ.pick_runner},
                              {label:'🥉',team:entry.champ.pick_third}
                            ].map(({label,team})=>(
                              <div key={label} className="flex items-center gap-2 justify-end">
                                <span className="text-[12px] text-gray-500 font-medium">{team}</span>
                                <FlagImg team={team} size={24} className="rounded-sm" />
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

        {ranking.length===0&&(
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.75" strokeLinecap="round"><path d="M6 9H4a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1h-2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4v5a5 5 0 0 0 10 0V4H7Z"/></svg>
            </div>
            <p className="text-[14px] text-gray-400 leading-relaxed">Nenhum resultado ainda.<br/>Aguarde os jogos!</p>
          </div>
        )}
        <div className="h-4"/>
      </div>
    </Layout>
  )
}
