import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Player, FASE_ORDER } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type SyncResult = { ok:boolean; synced:number; updated:number; recalculated:boolean; quotaRemaining:number|null; timestamp:string; error?:string }

export default function AdminPage() {
  const { player, loading, isAdmin } = useAuth()
  const router = useRouter()
  const [matches,     setMatches]     = useState<Match[]>([])
  const [players,     setPlayers]     = useState<Player[]>([])
  const [fetching,    setFetching]    = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [syncResult,  setSyncResult]  = useState<SyncResult|null>(null)
  const [recalcing,   setRecalcing]   = useState(false)
  const [recalcMsg,   setRecalcMsg]   = useState('')
  const [editId,      setEditId]      = useState<string|null>(null)
  const [resH,        setResH]        = useState('')
  const [resA,        setResA]        = useState('')
  const [saving,      setSaving]      = useState(false)
  const [activePhase, setActivePhase] = useState('Fase de Grupos')
  const [activeTab,   setActiveTab]   = useState<'matches'|'players'>('matches')

  useEffect(()=>{ if(!loading){ if(!player){router.push('/');return}; if(!isAdmin){router.push('/ranking');return} } },[loading,player,isAdmin])

  const fetchAll = useCallback(async()=>{
    const [{ data:mData },{ data:pData }] = await Promise.all([
      supabase.from('matches').select('*').order('sort_order'),
      supabase.from('players').select('*').order('created_at'),
    ])
    setMatches((mData||[]) as Match[])
    setPlayers((pData||[]) as Player[])
    setFetching(false)
  },[])

  useEffect(()=>{ fetchAll() },[fetchAll])

  async function triggerSync() {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:process.env.NEXT_PUBLIC_ADMIN_NICKNAME})})
      const data: SyncResult = await res.json()
      setSyncResult(data); if(data.ok) fetchAll()
    } catch { setSyncResult({ok:false,synced:0,updated:0,recalculated:false,quotaRemaining:null,timestamp:new Date().toISOString(),error:'Erro de rede'}) }
    setSyncing(false)
  }

  async function recalcScores() {
    setRecalcing(true)
    const {error} = await supabase.rpc('recalc_all_scores')
    setRecalcMsg(error?'Erro ao recalcular.':'Pontuações recalculadas!')
    setTimeout(()=>setRecalcMsg(''),3000); setRecalcing(false)
  }

  async function saveResult(match:Match) {
    if(resH===''||resA==='') return
    setSaving(true)
    await supabase.from('matches').update({score_home:Number(resH),score_away:Number(resA),status:'done'}).eq('id',match.id)
    setSaving(false); setEditId(null); fetchAll(); await recalcScores()
  }

  async function togglePayment(p:Player) {
    await supabase.from('players').update({payment_ok:!p.payment_ok}).eq('id',p.id)
    fetchAll()
  }

  const phases = FASE_ORDER.filter(f=>matches.some(m=>m.fase===f))
  const filteredMatches = matches.filter(m=>m.fase===activePhase)

  if(loading||fetching||!isAdmin) return <div className="min-h-screen flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/></div>

  return (
    <Layout title="Admin">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Top actions */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card bg-white border border-gray-100 rounded-2xl p-4">
            <p className="font-semibold text-gray-900 text-[14px] mb-0.5">Sincronizar API</p>
            <p className="text-[11px] text-gray-400 mb-3">The Odds API · Copa 2026</p>
            <button onClick={triggerSync} disabled={syncing}
              className="w-full py-2.5 rounded-xl bg-[#0099CC] text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[#007aa8] disabled:opacity-50">
              {syncing?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Sincronizar agora'}
            </button>
            {syncResult&&<p className={`text-[11px] mt-2 ${syncResult.ok?'text-green-600':'text-red-500'}`}>{syncResult.ok?`+${syncResult.synced} novos · ${syncResult.updated} atualizados`:syncResult.error}</p>}
          </div>
          <div className="card bg-white border border-gray-100 rounded-2xl p-4">
            <p className="font-semibold text-gray-900 text-[14px] mb-0.5">Recalcular</p>
            <p className="text-[11px] text-gray-400 mb-3">Pontuações e ranking</p>
            <button onClick={recalcScores} disabled={recalcing}
              className="w-full py-2.5 rounded-xl bg-gray-800 text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-gray-900 disabled:opacity-50">
              {recalcing?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Recalcular'}
            </button>
            {recalcMsg&&<p className="text-[11px] mt-2 text-green-600">{recalcMsg}</p>}
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['matches','players'] as const).map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab===t?'bg-white text-[#0099CC] shadow-sm':'text-gray-400'}`}>
              {t==='matches'?`Partidas (${matches.length})`:`Participantes (${players.length})`}
            </button>
          ))}
        </div>

        {/* Matches tab */}
        {activeTab==='matches'&&(
          <>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
              {phases.map(f=>(
                <button key={f} onClick={()=>setActivePhase(f)}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${activePhase===f?'bg-[#0099CC] text-white':'bg-white border border-gray-200 text-gray-500'}`}>
                  {f==='Fase de Grupos'?'Grupos':f} ({matches.filter(m=>m.fase===f).length})
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredMatches.map(m=>(
                <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {m.status==='live'&&<span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>Ao vivo</span>}
                      {m.status==='done'&&<span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">Encerrado</span>}
                      {m.status==='upcoming'&&<span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">Em breve</span>}
                      {m.match_date&&<span className="text-[11px] text-gray-400">{format(parseISO(m.match_date),'dd/MM HH:mm',{locale:ptBR})}</span>}
                    </div>
                    <div className="flex gap-1">
                      {m.status!=='live'&&<button onClick={async()=>{await supabase.from('matches').update({status:'live'}).eq('id',m.id);fetchAll()}} className="text-[11px] text-red-600 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">Ao vivo</button>}
                      {m.status!=='upcoming'&&<button onClick={async()=>{await supabase.from('matches').update({status:'upcoming',score_home:null,score_away:null}).eq('id',m.id);fetchAll()}} className="text-[11px] border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">Reset</button>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-gray-800">{m.home_flag} {m.home_team}</span>
                    {editId===m.id?(
                      <div className="flex items-center gap-1.5">
                        <input type="number" min="0" max="20" value={resH} onChange={e=>setResH(e.target.value)} className="w-11 h-10 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900"/>
                        <span className="text-gray-400">×</span>
                        <input type="number" min="0" max="20" value={resA} onChange={e=>setResA(e.target.value)} className="w-11 h-10 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900"/>
                        <button onClick={()=>saveResult(m)} disabled={saving} className="text-[11px] bg-[#0099CC] text-white px-3 py-2 rounded-xl">{saving?'...':'OK'}</button>
                        <button onClick={()=>setEditId(null)} className="text-[11px] border border-gray-200 px-2 py-2 rounded-xl">✕</button>
                      </div>
                    ):(
                      <div className="flex items-center gap-2">
                        {m.status==='done'?<span className="text-[16px] font-bold text-gray-800">{m.score_home} × {m.score_away}</span>:<span className="text-gray-300 font-medium">vs</span>}
                        <button onClick={()=>{setEditId(m.id);setResH(m.score_home!==undefined&&m.score_home!==null?String(m.score_home):'');setResA(m.score_away!==undefined&&m.score_away!==null?String(m.score_away):'')}} className="text-[11px] border border-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-50">Editar</button>
                      </div>
                    )}
                    <span className="text-[13px] font-semibold text-gray-800">{m.away_team} {m.away_flag}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Players tab */}
        {activeTab==='players'&&(
          <div className="space-y-2">
            {players.map(p=>{
              const av = p.avatar_url ? (p.avatar_url.startsWith('http')?p.avatar_url:supabase.storage.from('avatars').getPublicUrl(p.avatar_url).data.publicUrl) : null
              const name = p.nickname||p.username
              return (
                <div key={p.id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                  {av?(<img src={av} alt={name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"/>):(
                    <div className="w-10 h-10 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[11px] font-bold text-[#0099CC] flex-shrink-0">
                      {(name||'?').split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-[14px] truncate">{name}</p>
                    <p className="text-[11px] text-gray-400">@{p.username}</p>
                  </div>
                  <button onClick={()=>togglePayment(p)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all ${p.payment_ok?'bg-green-50 border-green-200 text-green-700 hover:bg-green-100':'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
                    {p.payment_ok?(
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Pago</>
                    ):(
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Confirmar pagto</>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
