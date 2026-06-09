import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import FlagImg from '@/components/FlagImg'
import { TEAMS_SELECT } from '@/lib/flags'

const MAX_CHAMP_EDITS = 3
const PRIZE_PCT = { first: 60, second: 25, third: 15 }
const ENTRY_FEE = 10

const IcoTrophy = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1h-2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4v5a5 5 0 0 0 10 0V4H7Z"/></svg>
const IcoLock  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IcoCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoArrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
const IcoInfo  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>

const POSITIONS = [
  { key:'champion', label:'Campeão',      pts:'+50 pts', ptColor:'text-amber-700',  border:'border-amber-200 bg-amber-50'  },
  { key:'runner',   label:'Vice-campeão', pts:'+25 pts', ptColor:'text-slate-600',  border:'border-slate-200 bg-slate-50'  },
  { key:'third',    label:'3º lugar',     pts:'+10 pts', ptColor:'text-orange-700', border:'border-orange-200 bg-orange-50'},
]

function MedalGold({ size=36 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none"><circle cx="20" cy="26" r="11" fill="#FFF8E1" stroke="#B8860B" strokeWidth="1.5"/><path d="M13 14 11 7l9 3 9-3-2 7" fill="#FFD700" stroke="#B8860B" strokeWidth="1.2" strokeLinejoin="round"/><text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7a5800" fontFamily="sans-serif">1</text></svg>
}
function MedalSilver({ size=36 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none"><circle cx="20" cy="26" r="11" fill="#F5F5F5" stroke="#6C757D" strokeWidth="1.5"/><path d="M13 14 11 7l9 3 9-3-2 7" fill="#CED4DA" stroke="#6C757D" strokeWidth="1.2" strokeLinejoin="round"/><text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#495057" fontFamily="sans-serif">2</text></svg>
}
function MedalBronze({ size=36 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none"><circle cx="20" cy="26" r="11" fill="#FFF0E6" stroke="#A0522D" strokeWidth="1.5"/><path d="M13 14 11 7l9 3 9-3-2 7" fill="#E8A87C" stroke="#A0522D" strokeWidth="1.2" strokeLinejoin="round"/><text x="20" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7B3F00" fontFamily="sans-serif">3</text></svg>
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}

export default function ChampionPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [champion, setChampion] = useState('')
  const [runner,   setRunner]   = useState('')
  const [third,    setThird]    = useState('')
  const [locked,   setLocked]   = useState(false)
  const [editCount,setEditCount]= useState(0)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [fetching, setFetching] = useState(true)
  const [paidCount,setPaidCount]= useState(0)
  const [extraAmount, setExtraAmount] = useState(0)
  const [extraNote,   setExtraNote]   = useState('')

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  useEffect(() => {
    if (!player) return
    Promise.all([
      supabase.from('champion_picks').select('*').eq('player_id', player.id).maybeSingle(),
      supabase.from('players').select('id', { count:'exact', head:true }).eq('payment_ok', true),
      supabase.from('prize_config').select('*').maybeSingle(),
    ]).then(([{ data }, { count }, { data: prizeData }]) => {
      if (data) {
        setChampion(data.pick_champion); setRunner(data.pick_runner); setThird(data.pick_third)
        setLocked(data.locked || (data.edit_count >= MAX_CHAMP_EDITS))
        setEditCount(data.edit_count || 0)
      }
      setPaidCount(count || 0)
      if (prizeData) {
        setExtraAmount(Number(prizeData.extra_amount) || 0)
        setExtraNote(prizeData.extra_note || '')
      }
      setFetching(false)
    })
  }, [player])

  const prizePool   = paidCount * ENTRY_FEE + extraAmount
  const prizeFirst  = Math.floor(prizePool * PRIZE_PCT.first  / 100)
  const prizeSecond = Math.floor(prizePool * PRIZE_PCT.second / 100)
  const prizeThird  = Math.floor(prizePool * PRIZE_PCT.third  / 100)
  const editsLeft   = MAX_CHAMP_EDITS - editCount
  const isFirstSave = editCount === 0 && !champion

  async function handleSave() {
    if (!player || !champion || !runner || !third) return
    if (champion === runner || champion === third || runner === third) return
    if (locked) return
    setSaving(true)
    const isEdit = !!champion
    const newEditCount = isEdit ? editCount + 1 : 0
    await supabase.from('champion_picks').upsert({
      player_id: player.id, pick_champion: champion, pick_runner: runner, pick_third: third,
      edit_count: newEditCount, locked: newEditCount >= MAX_CHAMP_EDITS,
    }, { onConflict: 'player_id' })
    setEditCount(newEditCount)
    if (newEditCount >= MAX_CHAMP_EDITS) setLocked(true)
    setSaving(false); setSaved(true)
    setTimeout(() => { setSaved(false); router.push('/picks') }, 1300)
  }

  const exclude = (e1: string, e2: string) => TEAMS_SELECT.filter(t => t !== e1 && t !== e2)
  const canSave = champion && runner && third && champion !== runner && champion !== third && runner !== third

  if (loading || fetching) return <div className="min-h-screen flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/></div>

  return (
    <Layout title="Palpite de Campeão">
      <div className="max-w-md mx-auto px-4 py-5 space-y-4">

        {/* Header — sem texto extra */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E6F4FA] flex items-center justify-center flex-shrink-0 text-[#0099CC]"><IcoTrophy /></div>
          <div>
            <h2 className="font-bold text-gray-900 text-[15px]">Quem vai vencer a Copa 2026?</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">Escolha antes dos jogos começarem</p>
          </div>
        </div>

        {/* Prize pool */}
        {prizePool > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Premiação confirmada</span>
              <div className="text-right">
                <span className="text-[12px] font-semibold text-[#0099CC]">{paidCount} pagamentos · {formatBRL(paidCount * ENTRY_FEE)}</span>
                {extraAmount > 0 && (
                  <div className="text-[11px] text-green-600 font-semibold">+ {formatBRL(extraAmount)} patrocínio{extraNote ? ` · ${extraNote}` : ''}</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {[
                { pos:'1º', Icon:MedalGold,   prize:prizeFirst,  pct:PRIZE_PCT.first,  bg:'bg-amber-50'  },
                { pos:'2º', Icon:MedalSilver, prize:prizeSecond, pct:PRIZE_PCT.second, bg:'bg-slate-50'  },
                { pos:'3º', Icon:MedalBronze, prize:prizeThird,  pct:PRIZE_PCT.third,  bg:'bg-orange-50' },
              ].map(({ pos, Icon, prize, pct, bg }) => (
                <div key={pos} className={`${bg} flex flex-col items-center py-4 px-2`}>
                  <Icon size={36} />
                  <p className="text-[11px] font-semibold text-gray-500 mt-2">{pos} · {pct}%</p>
                  <p className="text-[16px] font-bold text-gray-900 mt-0.5">{formatBRL(prize)}</p>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1.5">
                <IcoInfo />
                Total: {formatBRL(prizePool)} · Atualiza conforme pagamentos confirmados
              </p>
            </div>
          </div>
        )}

        {paidCount === 0 && extraAmount === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2.5">
            <IcoInfo />
            <p className="text-[12px] text-gray-500">A premiação será exibida conforme os pagamentos forem confirmados.</p>
          </div>
        )}

        {/* Points cards */}
        <div className="grid grid-cols-3 gap-2.5">
          {POSITIONS.map(({ label, pts, border, ptColor }) => (
            <div key={label} className={`rounded-xl border p-3 text-center ${border}`}>
              <div className="flex justify-center mb-1.5">
                {label==='Campeão' ? <MedalGold size={34}/> : label==='Vice-campeão' ? <MedalSilver size={34}/> : <MedalBronze size={34}/>}
              </div>
              <p className="text-[11px] font-semibold text-gray-600">{label}</p>
              <p className={`text-[13px] font-bold mt-0.5 ${ptColor}`}>{pts}</p>
            </div>
          ))}
        </div>

        {/* Edit limit */}
        {editCount > 0 && (
          <div className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${locked?'bg-red-50 border-red-200':editsLeft===1?'bg-amber-50 border-amber-200':'bg-blue-50 border-blue-100'}`}>
            <IcoLock />
            <div className="flex-1">
              <p className={`text-[12px] font-semibold ${locked?'text-red-700':editsLeft===1?'text-amber-700':'text-blue-700'}`}>
                {locked ? 'Limite de alterações atingido' : `${editsLeft} alteração${editsLeft===1?'':'ões'} restante${editsLeft===1?'':'s'}`}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Máximo de {MAX_CHAMP_EDITS} trocas permitidas</p>
            </div>
            <div className="flex gap-1">
              {Array.from({length:MAX_CHAMP_EDITS}).map((_,i)=>(
                <div key={i} className={`w-2 h-2 rounded-full ${i<editCount?(locked?'bg-red-400':'bg-amber-400'):'bg-gray-200'}`}/>
              ))}
            </div>
          </div>
        )}

        {/* Selects */}
        <div className="space-y-4">
          {[
            {state:champion,set:setChampion,ex1:runner,  ex2:third,  label:'Campeão',     pts:'+50 pts',ptColor:'text-amber-700' },
            {state:runner,  set:setRunner,  ex1:champion,ex2:third,  label:'Vice-campeão',pts:'+25 pts',ptColor:'text-slate-600' },
            {state:third,   set:setThird,   ex1:champion,ex2:runner, label:'3º lugar',    pts:'+10 pts',ptColor:'text-orange-700'},
          ].map(({ state, set, ex1, ex2, label, pts, ptColor }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <div className="flex items-center gap-2">
                  {label==='Campeão'?<MedalGold size={22}/>:label==='Vice-campeão'?<MedalSilver size={22}/>:<MedalBronze size={22}/>}
                  <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
                </div>
                <span className={`text-[12px] font-bold ${ptColor}`}>{pts}</span>
              </div>
              {state ? (
                <div className="mx-4 mb-2 flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  <FlagImg team={state} size={36} className="rounded"/>
                  <div>
                    <p className="text-[14px] font-bold text-gray-900">{state}</p>
                    <p className="text-[11px] text-gray-400">Selecionado</p>
                  </div>
                  {!locked && <button onClick={()=>set('')} className="ml-auto text-[11px] text-gray-400 hover:text-red-500">Trocar</button>}
                </div>
              ) : <p className="mx-4 mb-2 text-[12px] text-gray-400 italic">Nenhuma seleção escolhida</p>}
              <div className="px-4 pb-3.5">
                <select className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all"
                  value={state} onChange={e=>set(e.target.value)} disabled={locked}>
                  <option value="">Selecione a seleção...</option>
                  {exclude(ex1,ex2).map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>

        {locked && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <IcoLock />
            <div>
              <p className="text-[13px] font-semibold text-red-700">Palpite de campeão bloqueado</p>
              <p className="text-[11px] text-red-500 mt-0.5">{editCount>=MAX_CHAMP_EDITS?`Você atingiu o limite de ${MAX_CHAMP_EDITS} alterações.`:'A Copa já começou.'}</p>
            </div>
          </div>
        )}

        {!locked && (
          <button onClick={handleSave} disabled={!canSave||saving||saved}
            className="w-full py-4 rounded-xl font-bold text-[15px] text-white flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed bg-[#0099CC] hover:bg-[#007aa8] shadow-sm">
            {saved?<><IcoCheck/> Salvo! Abrindo palpites...</>:saving?<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:isFirstSave?<>Salvar palpite de campeão <IcoArrow/></>:<>Atualizar palpite ({editsLeft}/{MAX_CHAMP_EDITS}) <IcoArrow/></>}
          </button>
        )}
        {locked && (
          <button onClick={()=>router.push('/picks')} className="w-full py-4 rounded-xl font-bold text-[15px] text-white flex items-center justify-center gap-2 bg-[#0099CC] hover:bg-[#007aa8] transition-all">
            Ver palpites dos jogos <IcoArrow/>
          </button>
        )}
        <div className="text-center">
          <button onClick={()=>router.push('/picks')} className="text-[13px] text-gray-400 hover:text-gray-500 underline underline-offset-2">Pular por agora</button>
        </div>
      </div>
    </Layout>
  )
}
