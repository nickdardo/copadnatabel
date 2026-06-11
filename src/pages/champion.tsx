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

// Prazo final para palpite de campeão — 11/06/2026 às 14h (horário de Brasília)
const CHAMP_DEADLINE = new Date('2026-06-11T17:00:00Z') // 14h BRT = 17h UTC

function isDeadlinePassed(): boolean {
  return new Date() >= CHAMP_DEADLINE
}

function getCountdown(): string {
  const diff = CHAMP_DEADLINE.getTime() - Date.now()
  if (diff <= 0) return ''
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins  = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0)  return `${days}d ${hours}h restantes`
  if (hours > 0) return `${hours}h ${mins}min restantes`
  return `${mins}min restantes`
}

const IcoLock  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IcoCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoArrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
const IcoInfo  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>

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
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
  const [deadlinePassed, setDeadlinePassed] = useState(isDeadlinePassed())
  const [countdown, setCountdown] = useState(getCountdown())
  const [adminLocked, setAdminLocked] = useState(false)

  // Load admin lock state from pix_config
  useEffect(() => {
    supabase.from('pix_config').select('champ_bloqueado').limit(1).then(({ data }) => {
      if (data?.[0]) setAdminLocked(data[0].champ_bloqueado || false)
    })
  }, [])

  // Update countdown every minute
  useEffect(() => {
    const tick = () => {
      setDeadlinePassed(isDeadlinePassed())
      setCountdown(getCountdown())
    }
    tick()
    const interval = setInterval(tick, 30_000)
    return () => clearInterval(interval)
  }, [])
  const [fetching, setFetching] = useState(true)
  const [paidCount,setPaidCount]= useState(0)
  const [extraAmount,setExtraAmount]= useState(0)
  const [extraNote,  setExtraNote]  = useState('')

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  useEffect(() => {
    if (!player) return
    Promise.all([
      supabase.from('champion_picks').select('*').eq('player_id', player.id).maybeSingle(),
      supabase.from('players').select('id', { count:'exact', head:true }).eq('payment_ok', true).eq('is_admin', false),
      supabase.from('prize_config').select('*').limit(1),
    ]).then(([{ data }, { count }, { data: prizeRows }]) => {
      if (data) {
        setChampion(data.pick_champion); setRunner(data.pick_runner); setThird(data.pick_third)
        setLocked(data.locked || (data.edit_count >= MAX_CHAMP_EDITS))
        setEditCount(data.edit_count || 0)
      }
      setPaidCount(count || 0)
      if (prizeRows && prizeRows[0]) {
        setExtraAmount(Number(prizeRows[0].extra_amount) || 0)
        setExtraNote(prizeRows[0].extra_note || '')
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
    if (locked || adminLocked) return
    // Block saving for unpaid users
    if (!player.payment_ok) { router.push('/onboarding'); return }
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

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
    </div>
  )

  return (
    <Layout title="Bolão Copa 2026 BEL">
      <div className="max-w-md mx-auto px-4 py-5 space-y-4">

        {/* Payment gate banner */}
        {!player?.payment_ok && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-amber-900">Pagamento necessário para salvar</p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  Você pode escolher seus favoritos, mas o palpite de campeão só será salvo após confirmar o pagamento.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/onboarding')}
              className="mt-3 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors active:scale-[.98]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              Confirmar pagamento e liberar palpites
            </button>
          </div>
        )}

        {/* ── Hero header com tema Copa ─────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl shadow-md"
          style={{ background: 'linear-gradient(135deg, #003a6e 0%, #0064a8 50%, #0099CC 100%)' }}>
          {/* Decorative rings */}
          <div className="absolute inset-0 pointer-events-none">
            {[120,200,280].map(s => (
              <div key={s} className="absolute rounded-full border border-white/10"
                style={{ width:s, height:s, top:'50%', left:'50%', transform:'translate(-50%,-50%)' }}/>
            ))}
          </div>

          <div className="relative px-5 py-5 flex items-center gap-4">
            <img src="/copa2026-logo.jpg" alt="Copa 2026"
              className="w-16 h-16 rounded-xl object-contain bg-white/10 flex-shrink-0"
              style={{ backdropFilter:'blur(4px)' }}/>
            <div>
              <p className="text-white/70 text-[11px] font-semibold uppercase tracking-widest mb-0.5">
                Bolão Copa 2026 BEL
              </p>
              <h2 className="text-white font-bold text-[20px] leading-tight">
                Seu palpite de campeão
              </h2>
              <p className="text-white/60 text-[12px] mt-1">
                Escolha campeão, vice e 3º lugar antes dos jogos!
              </p>
            </div>
          </div>

          {/* Points bar */}
          <div className="relative grid grid-cols-3 border-t border-white/10">
            {[
              { label:'Campeão', pts:'+50 pts', color:'text-amber-300' },
              { label:'Vice',    pts:'+25 pts', color:'text-slate-300'  },
              { label:'3º lugar',pts:'+10 pts', color:'text-orange-300' },
            ].map(({ label, pts, color }) => (
              <div key={label} className="flex flex-col items-center py-3 border-r border-white/10 last:border-0">
                <span className="text-white/60 text-[10px] font-medium">{label}</span>
                <span className={`${color} text-[13px] font-bold mt-0.5`}>{pts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Prize pool ───────────────────────────────────── */}
        {prizePool > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Premiação confirmada</span>
              <div className="text-right">
                <span className="text-[12px] font-semibold text-[#0099CC]">{paidCount} pagtos · {formatBRL(paidCount * ENTRY_FEE)}</span>
                {extraAmount > 0 && (
                  <div className="text-[11px] text-green-600 font-semibold">+ {formatBRL(extraAmount)}{extraNote ? ` · ${extraNote}` : ' patrocínio'}</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {[
                { pos:'1º', Icon:MedalGold,   prize:prizeFirst,  bg:'bg-amber-50'  },
                { pos:'2º', Icon:MedalSilver, prize:prizeSecond, bg:'bg-slate-50'  },
                { pos:'3º', Icon:MedalBronze, prize:prizeThird,  bg:'bg-orange-50' },
              ].map(({ pos, Icon, prize, bg }) => (
                <div key={pos} className={`${bg} flex flex-col items-center py-4 px-2`}>
                  <Icon size={34}/>
                  <p className="text-[11px] font-semibold text-gray-500 mt-1.5">{pos}</p>
                  <p className="text-[15px] font-bold text-gray-900 mt-0.5">{formatBRL(prize)}</p>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0099CC] opacity-50"/>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0099CC]"/>
              </span>
              <p className="text-[15px] font-bold text-[#0099CC] tracking-tight">
                Total: {formatBRL(prizePool)}
              </p>
            </div>
          </div>
        )}

        {/* Edit limit indicator */}
        {/* Status banner — admin lock takes priority over deadline */}
        {adminLocked ? (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-red-50 border-red-200">
            <IcoLock/>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-red-700">Palpite bloqueado pelo administrador</p>
              <p className="text-[11px] text-red-500 mt-0.5">O admin desativou temporariamente os palpites de campeão. Aguarde a liberação.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-green-50 border-green-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-green-800">Palpite de campeão aberto</p>
              <p className="text-[11px] text-green-600 mt-0.5">
                {editCount > 0 ? `${editsLeft} alteração${editsLeft !== 1 ? 'ões' : ''} restante${editsLeft !== 1 ? 's' : ''}` : 'Escolha seu campeão, vice e 3º lugar.'}
              </p>
            </div>
            {editCount > 0 && (
              <div className="flex gap-1 flex-shrink-0">
                {Array.from({length:MAX_CHAMP_EDITS}).map((_,i)=>(
                  <div key={i} className={`w-2 h-2 rounded-full ${i<editCount?'bg-green-400':'bg-gray-200'}`}/>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Selects ──────────────────────────────────────── */}
        <div className="space-y-3">
          {[
            {state:champion,set:setChampion,ex1:runner,  ex2:third,  label:'Campeão',     pts:'+50 pts',ptColor:'text-amber-700', Medal:MedalGold   },
            {state:runner,  set:setRunner,  ex1:champion,ex2:third,  label:'Vice-campeão',pts:'+25 pts',ptColor:'text-slate-600', Medal:MedalSilver },
            {state:third,   set:setThird,   ex1:champion,ex2:runner, label:'3º lugar',    pts:'+10 pts',ptColor:'text-orange-700',Medal:MedalBronze },
          ].map(({ state, set, ex1, ex2, label, pts, ptColor, Medal }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <div className="flex items-center gap-2">
                  <Medal size={22}/>
                  <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
                </div>
                <span className={`text-[12px] font-bold ${ptColor}`}>{pts}</span>
              </div>

              {state ? (
                <div className="mx-4 mb-2 flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  <FlagImg team={state} size={36} className="rounded"/>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-gray-900">{state}</p>
                    <p className="text-[11px] text-gray-400">Selecionado</p>
                  </div>
                  {!locked && !adminLocked && (
                    <button onClick={()=>set('')} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">Trocar</button>
                  )}
                </div>
              ) : (
                <p className="mx-4 mb-2 text-[12px] text-gray-400 italic">Nenhuma seleção escolhida</p>
              )}

              <div className="px-4 pb-3.5">
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all"
                  value={state} onChange={e=>set(e.target.value)} disabled={locked || adminLocked || !player?.payment_ok}>
                  <option value="">Selecione a seleção...</option>
                  {exclude(ex1,ex2).map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>



        {!locked && !adminLocked && (
          <button onClick={handleSave} disabled={!canSave||saving||saved}
            className="w-full py-4 rounded-xl font-bold text-[15px] text-white flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed bg-[#0099CC] hover:bg-[#007aa8] shadow-sm">
            {saved?<><IcoCheck/> Salvo! Abrindo palpites...</>
             :saving?<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
             :isFirstSave?<>Salvar palpite de campeão <IcoArrow/></>
             :<>Atualizar ({editsLeft}/{MAX_CHAMP_EDITS} alt. restantes) <IcoArrow/></>}
          </button>
        )}
        {locked && (
          <button onClick={()=>router.push('/picks')}
            className="w-full py-4 rounded-xl font-bold text-[15px] text-white flex items-center justify-center gap-2 bg-[#0099CC] hover:bg-[#007aa8] transition-all">
            Ver palpites dos jogos <IcoArrow/>
          </button>
        )}
        <div className="text-center">
          <button onClick={()=>router.push('/picks')} className="text-[13px] text-gray-400 hover:text-gray-500 underline underline-offset-2">
            Pular por agora
          </button>
        </div>
      </div>
    </Layout>
  )
}
