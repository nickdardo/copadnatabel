import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match, Pick, calcFactor, FACTOR_PTS, FACTOR_COLOR, FASE_ORDER, EditLimit } from '@/lib/supabase'
import Layout from '@/components/Layout'
import FlagImg from '@/components/FlagImg'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PickMap  = Record<string,{home:string;away:string;saved:boolean;editCount:number}>
type LimitMap = Record<string,EditLimit>  // key = `${fase}:${roundIndex}`
const ROUND_SIZE = 8
const MAX_EDITS  = 5

const IcoCheck  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoBall   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
const IcoArrow  = ({left=false}:{left?:boolean}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points={left?"15 18 9 12 15 6":"9 6 15 12 9 18"}/></svg>

export default function PicksPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [matches,     setMatches]     = useState<Match[]>([])
  const [picks,       setPicks]       = useState<PickMap>({})
  const [limits,      setLimits]      = useState<LimitMap>({})
  const [saving,      setSaving]      = useState(false)
  const [fetching,    setFetching]    = useState(true)
  const [activePhase, setActivePhase] = useState('')
  const [tab,         setTab]         = useState<'upcoming'|'live'|'done'>('upcoming')
  const [round,       setRound]       = useState(0)
  const [batchSaved,  setBatchSaved]  = useState(false)

  useEffect(() => { if (!loading&&!player) router.push('/') },[loading,player])

  const fetchData = useCallback(async () => {
    if (!player) return
    const [{ data:mData },{ data:pData },{ data:lData }] = await Promise.all([
      supabase.from('matches').select('*').order('sort_order'),
      supabase.from('picks').select('*').eq('player_id',player.id),
      supabase.from('pick_edit_limits').select('*').eq('player_id',player.id),
    ])
    const ms = (mData||[]) as Match[]
    setMatches(ms)
    const pm: PickMap = {}
    ms.forEach(m => { pm[m.id]={home:'',away:'',saved:false,editCount:0} });
    (pData||[]).forEach((p:Pick)=>{pm[p.match_id]={home:String(p.pick_home),away:String(p.pick_away),saved:true,editCount:p.edit_count||0}})
    setPicks(pm)
    const lm: LimitMap = {}
    ;(lData||[]).forEach((l:EditLimit)=>{ lm[`${l.fase}:${l.round_index}`]=l })
    setLimits(lm)
    const phases = FASE_ORDER.filter(f=>ms.some(m=>m.fase===f))
    const first  = phases.find(f=>ms.some(m=>m.fase===f&&(m.status==='upcoming'||m.status==='live')))||phases[0]
    setActivePhase(first||'')
    setFetching(false)
  },[player])

  useEffect(()=>{fetchData()},[fetchData])

  const isLocked = (m:Match) =>
    m.status==='done'||m.status==='live'||(m.match_date?isPast(parseISO(m.match_date)):false)

  const phaseMatches    = matches.filter(m=>m.fase===activePhase)
  const isGroups        = activePhase==='Fase de Grupos'
  const upcomingMatches = phaseMatches.filter(m=>m.status==='upcoming'&&!isPast(parseISO(m.match_date||'')))
  const liveMatches     = phaseMatches.filter(m=>m.status==='live')
  const doneMatches     = phaseMatches.filter(m=>m.status==='done'||(m.match_date&&isPast(parseISO(m.match_date))&&m.status!=='live'))

  const upcomingRounds = isGroups
    ? Array.from({length:Math.ceil(upcomingMatches.length/ROUND_SIZE)},(_,i)=>upcomingMatches.slice(i*ROUND_SIZE,(i+1)*ROUND_SIZE))
    : [upcomingMatches]
  const safeRound    = Math.min(round,upcomingRounds.length-1)
  const currentRound = upcomingRounds[safeRound]||[]

  const tabMatches = tab==='live'?liveMatches:tab==='done'?doneMatches:currentRound

  // Edit limit for current round
  const limitKey    = `${activePhase}:${safeRound}`
  const editLimit   = limits[limitKey]
  const editsUsed   = editLimit?.edits_used||0
  const editsLeft   = MAX_EDITS - editsUsed
  const roundLocked = editsLeft <= 0

  function updatePick(matchId:string,side:'home'|'away',val:string) {
    if (roundLocked) return
    setPicks(p=>({...p,[matchId]:{...p[matchId],[side]:val.replace(/\D/g,'').slice(0,2),saved:false}}))
  }

  async function confirmAll() {
    if (!player||saving) return
    const toSave = currentRound.filter(m=>{
      const p=picks[m.id]; return !isLocked(m)&&p&&p.home!==''&&p.away!==''
    })
    if (!toSave.length) return
    setSaving(true)

    // Check how many new unsaved picks there are
    const newPicks = toSave.filter(m=>!picks[m.id].saved)
    const isEdit   = editsUsed > 0 || toSave.some(m=>picks[m.id].saved===false && picks[m.id].editCount > 0)

    await Promise.all(toSave.map(m=>
      supabase.from('picks').upsert({
        player_id:player.id, match_id:m.id,
        pick_home:Number(picks[m.id].home), pick_away:Number(picks[m.id].away),
        submitted_at:new Date().toISOString(),
        edit_count:(picks[m.id].editCount||0),
      },{onConflict:'player_id,match_id'})
    ))

    // Update edit limit if this is modifying previously saved picks
    if (isEdit && newPicks.length < toSave.length) {
      const newEdits = editsUsed + 1
      await supabase.from('pick_edit_limits').upsert({
        player_id:player.id, fase:activePhase, round_index:safeRound,
        edits_used:newEdits, max_edits:MAX_EDITS,
      },{onConflict:'player_id,fase,round_index'})
      setLimits(l=>({...l,[limitKey]:{...editLimit||{player_id:player.id,fase:activePhase,round_index:safeRound,max_edits:MAX_EDITS},edits_used:newEdits}}))
    }

    setPicks(p=>{
      const next={...p}
      toSave.forEach(m=>{next[m.id]={...next[m.id],saved:true}})
      return next
    })
    setSaving(false); setBatchSaved(true)
    setTimeout(()=>setBatchSaved(false),3000)
  }

  const phases   = FASE_ORDER.filter(f=>matches.some(m=>m.fase===f))
  const filled   = tabMatches.filter(m=>{const p=picks[m.id];return p&&p.home!==''&&p.away!==''}).length
  const allSaved = tabMatches.every(m=>picks[m.id]?.saved===true||isLocked(m))

  if (loading||fetching) return <div className="min-h-screen flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/></div>

  return (
    <Layout title="Palpites">
      <div className="max-w-lg mx-auto px-4 pt-5">
        <div className="text-center mb-4">
          <h1 className="text-[18px] font-bold text-gray-900">Palpites</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Bolão dnata · Copa do Mundo 2026</p>
        </div>

        {/* Phase tabs */}
        {phases.length>1&&(
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4" style={{scrollbarWidth:'none'}}>
            {phases.map(f=>(
              <button key={f} onClick={()=>{setActivePhase(f);setRound(0);setTab('upcoming')}}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${activePhase===f?'bg-[#0099CC] text-white':'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                {f==='Fase de Grupos'?'Grupos':f}
              </button>
            ))}
          </div>
        )}

        {/* Status tabs */}
        <div className="flex bg-white border border-gray-100 rounded-2xl p-1.5 mb-4 shadow-sm">
          {([['live','Ao vivo',liveMatches.length],['upcoming','Próximos',upcomingMatches.length],['done','Definidos',doneMatches.length]] as [typeof tab,string,number][]).map(([key,label,count])=>(
            <button key={key} onClick={()=>setTab(key)}
              className={`flex-1 relative flex items-center justify-center gap-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${tab===key?'bg-[#0099CC] text-white shadow-sm':'text-gray-400 hover:text-gray-600'}`}>
              {label}
              {count>0&&<span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${tab===key?'bg-white/25 text-white':'bg-amber-400 text-white'}`}>{count>9?'9+':count}</span>}
            </button>
          ))}
        </div>

        {/* Edit limit warning */}
        {tab==='upcoming'&&editLimit&&editsLeft<=2&&editsLeft>0&&(
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span className="text-[12px] text-amber-700 font-medium">
              Atenção! Você tem apenas <strong>{editsLeft} alteração{editsLeft===1?'':'ões'}</strong> restante{editsLeft===1?'':'s'} nesta rodada.
            </span>
          </div>
        )}
        {tab==='upcoming'&&roundLocked&&(
          <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span className="text-[12px] text-red-700 font-medium">Limite de alterações atingido para esta rodada.</span>
          </div>
        )}

        {/* Round nav */}
        {tab==='upcoming'&&isGroups&&upcomingRounds.length>1&&(
          <div className="flex items-center justify-between mb-3 px-1">
            <button onClick={()=>{if(safeRound>0){setRound(r=>r-1)}}} disabled={safeRound===0}
              className="flex items-center gap-1 text-[12px] font-semibold text-gray-400 disabled:opacity-30 hover:text-gray-600 transition-colors">
              <IcoArrow left /> Anterior
            </button>
            <div className="text-center">
              <span className="text-[12px] text-gray-500 font-semibold">Rodada {safeRound+1} / {upcomingRounds.length}</span>
              {editsUsed>0&&<span className="ml-2 text-[11px] text-amber-600">{editsLeft} alt. restante{editsLeft===1?'':'s'}</span>}
            </div>
            <button onClick={()=>{if(safeRound<upcomingRounds.length-1){setRound(r=>r+1)}}} disabled={safeRound===upcomingRounds.length-1}
              className="flex items-center gap-1 text-[12px] font-semibold text-[#0099CC] disabled:opacity-30 hover:text-[#007aa8] transition-colors">
              Próxima <IcoArrow />
            </button>
          </div>
        )}

        <p className="text-[12px] text-gray-400 text-center mb-4">
          {tab==='upcoming'?'Próximos jogos para palpitar.':tab==='live'?'Jogos acontecendo agora.':'Resultados e seus palpites.'}
        </p>
      </div>

      {/* Matches */}
      <div className="max-w-lg mx-auto px-4 space-y-3 pb-32">
        {tabMatches.map(m=>{
          const pick   = picks[m.id]||{home:'',away:'',saved:false,editCount:0}
          const locked = isLocked(m)||(tab==='upcoming'&&roundLocked&&pick.saved)
          const factor = m.status==='done'&&m.score_home!==undefined&&pick.home!==''
            ?calcFactor(Number(pick.home),Number(pick.away),m.score_home!,m.score_away!):null
          const dateStr = m.match_date
            ?format(parseISO(m.match_date),"EEE, dd/MM/yy HH:mm",{locale:ptBR}).toUpperCase():''
          const fase = m.fase==='Fase de Grupos'?'1ª FASE':m.fase.toUpperCase()

          return (
            <div key={m.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              {/* Card header */}
              <div className={`px-4 py-2 flex items-center justify-between text-[11px] border-b ${m.status==='live'?'bg-red-50 border-red-100':m.status==='done'?'bg-gray-50 border-gray-100':'bg-blue-50/40 border-blue-100/50'}`}>
                <div className="flex items-center gap-2">
                  {m.status==='live'&&<span className="flex items-center gap-1.5 font-bold text-red-600"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>AO VIVO</span>}
                  {m.status==='done'&&<span className="font-medium text-gray-500">Encerrado</span>}
                  {m.status==='upcoming'&&m.match_date&&<span className="text-gray-500 font-medium">{dateStr} · {fase}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {factor&&<span className={`px-2 py-0.5 rounded-md font-bold ${FACTOR_COLOR[factor]}`}>+{FACTOR_PTS[factor]}pts · {factor}</span>}
                  {!locked&&pick.saved&&!factor&&<span className="flex items-center gap-1 text-green-600 font-semibold"><IcoCheck />Salvo</span>}
                </div>
              </div>

              {/* Match body */}
              <div className="px-4 py-5 flex items-center gap-2">
                {/* Home */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <FlagImg team={m.home_team} dbFlag={m.home_flag} size={48} />
                  <span className="text-[12px] font-bold text-gray-700 text-center leading-tight uppercase tracking-wide">{m.home_team}</span>
                </div>

                {/* Inputs */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {locked?(
                    <>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold border-2 ${pick.home!==''?'border-gray-200 bg-gray-50 text-gray-800':'border-gray-100 bg-gray-50 text-gray-300'}`}>{pick.home!==''?pick.home:'–'}</div>
                      <span className="text-gray-200 text-xl">×</span>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold border-2 ${pick.away!==''?'border-gray-200 bg-gray-50 text-gray-800':'border-gray-100 bg-gray-50 text-gray-300'}`}>{pick.away!==''?pick.away:'–'}</div>
                    </>
                  ):(
                    <>
                      <input type="number" min="0" max="20" inputMode="numeric"
                        className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-2xl bg-gray-50 text-gray-900 focus:outline-none focus:border-[#0099CC] transition-colors"
                        value={pick.home} onChange={e=>updatePick(m.id,'home',e.target.value)} placeholder="0"/>
                      <span className="text-gray-200 text-xl">×</span>
                      <input type="number" min="0" max="20" inputMode="numeric"
                        className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-2xl bg-gray-50 text-gray-900 focus:outline-none focus:border-[#0099CC] transition-colors"
                        value={pick.away} onChange={e=>updatePick(m.id,'away',e.target.value)} placeholder="0"/>
                    </>
                  )}
                </div>

                {/* Away */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <FlagImg team={m.away_team} dbFlag={m.away_flag} size={48} />
                  <span className="text-[12px] font-bold text-gray-700 text-center leading-tight uppercase tracking-wide">{m.away_team}</span>
                </div>
              </div>

              {m.status==='done'&&m.score_home!==undefined&&(
                <div className="pb-3 text-center">
                  <span className="text-[11px] text-gray-400">Resultado: <strong className="text-gray-600">{m.score_home} × {m.score_away}</strong></span>
                </div>
              )}
              {locked&&pick.home!==''&&(
                <div className="pb-3 flex justify-center">
                  <span className={`text-[11px] font-semibold flex items-center gap-1 px-3 py-1 rounded-full ${factor?FACTOR_COLOR[factor]:'bg-green-50 text-green-600'}`}>
                    <IcoCheck />{factor?`${factor} +${FACTOR_PTS[factor]}pts`:'Palpite registrado'}
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {tabMatches.length===0&&(
          <div className="text-center py-14">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-300"><IcoBall /></div>
            <p className="text-[13px] text-gray-400">{tab==='live'?'Nenhum jogo ao vivo.':tab==='upcoming'?'Nenhum jogo para palpitar.':'Nenhum jogo encerrado ainda.'}</p>
          </div>
        )}
      </div>

      {/* Fixed CTA */}
      {tab==='upcoming'&&tabMatches.length>0&&!roundLocked&&(
        <div className="fixed bottom-16 left-0 right-0 z-20 px-4 pb-2">
          <div className="max-w-lg mx-auto">
            <button onClick={confirmAll} disabled={saving||filled===0}
              className={`w-full py-4 rounded-2xl font-bold text-[15px] tracking-wide transition-all active:scale-[.98] shadow-lg flex items-center justify-center gap-2 ${batchSaved?'bg-green-500 text-white':'bg-[#0099CC] text-white hover:bg-[#007aa8] disabled:opacity-50 disabled:cursor-not-allowed'}`}>
              {saving?<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
               :batchSaved?<><IcoCheck /> PALPITES CONFIRMADOS!</>
               :filled>0?`CONFIRMAR PALPITES (${filled})`:'PREENCHA OS PLACARES'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
