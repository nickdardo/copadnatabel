import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { IconGold, IconSilver, IconBronze, IconTrophy, IconLock, IconCheck, IconArrowRight } from '@/components/Icons'

// Flag map for display in select options
const TEAM_FLAGS: Record<string, string> = {
  'Albania':'🇦🇱','Alemanha':'🇩🇪','Argentina':'🇦🇷','Arábia Saudita':'🇸🇦',
  'Austrália':'🇦🇺','Áustria':'🇦🇹','Bélgica':'🇧🇪','Bolívia':'🇧🇴',
  'Brasil':'🇧🇷','Camarões':'🇨🇲','Canadá':'🇨🇦','Cazaquistão':'🇰🇿',
  'Chile':'🇨🇱','Colômbia':'🇨🇴','Coreia do Sul':'🇰🇷','Costa Rica':'🇨🇷',
  'Croácia':'🇭🇷','Dinamarca':'🇩🇰','Equador':'🇪🇨','Eslováquia':'🇸🇰',
  'Eslovênia':'🇸🇮','Espanha':'🇪🇸','Estados Unidos':'🇺🇸','França':'🇫🇷',
  'Geórgia':'🇬🇪','Honduras':'🇭🇳','Hungria':'🇭🇺','Inglaterra':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Irã':'🇮🇷','Iraque':'🇮🇶','Israel':'🇮🇱','Itália':'🇮🇹',
  'Jamaica':'🇯🇲','Japão':'🇯🇵','Marrocos':'🇲🇦','México':'🇲🇽',
  'Moçambique':'🇲🇿','Nigéria':'🇳🇬','Noruega':'🇳🇴','Nova Zelândia':'🇳🇿',
  'Países Baixos':'🇳🇱','Panamá':'🇵🇦','Paraguai':'🇵🇾','Peru':'🇵🇪',
  'Portugal':'🇵🇹','RD Congo':'🇨🇩','Romênia':'🇷🇴','Sérvia':'🇷🇸',
  'Senegal':'🇸🇳','Suécia':'🇸🇪','Suíça':'🇨🇭','Tchéquia':'🇨🇿',
  'Turquia':'🇹🇷','Uruguai':'🇺🇾','Venezuela':'🇻🇪',
}
const TEAMS = Object.keys(TEAM_FLAGS).sort()

const POSITIONS = [
  { key:'champion', label:'Campeão',      pts:'+50 pts', Icon:IconGold,   ptColor:'text-amber-700', border:'border-amber-200 bg-amber-50'  },
  { key:'runner',   label:'Vice-campeão', pts:'+25 pts', Icon:IconSilver, ptColor:'text-slate-600', border:'border-slate-200 bg-slate-50'  },
  { key:'third',    label:'3º lugar',     pts:'+10 pts', Icon:IconBronze, ptColor:'text-orange-700',border:'border-orange-200 bg-orange-50' },
]

export default function ChampionPage() {
  const { player, loading } = useAuth()
  const router = useRouter()
  const [champion, setChampion] = useState('')
  const [runner,   setRunner]   = useState('')
  const [third,    setThird]    = useState('')
  const [locked,   setLocked]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  useEffect(() => {
    if (!player) return
    supabase.from('champion_picks').select('*').eq('player_id', player.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setChampion(data.pick_champion); setRunner(data.pick_runner); setThird(data.pick_third); setLocked(data.locked) }
        setFetching(false)
      })
  }, [player])

  async function handleSave() {
    if (!player || !champion || !runner || !third) return
    if (champion === runner || champion === third || runner === third) return
    setSaving(true)
    await supabase.from('champion_picks').upsert({
      player_id: player.id, pick_champion: champion, pick_runner: runner, pick_third: third,
    }, { onConflict: 'player_id' })
    setSaving(false); setSaved(true)
    setTimeout(() => router.push('/picks'), 1200)
  }

  const exclude = (e1: string, e2: string) => TEAMS.filter(t => t !== e1 && t !== e2)
  const canSave = champion && runner && third && champion !== runner && champion !== third && runner !== third

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
    </div>
  )

  return (
    <Layout title="Palpite de Campeão">
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E6F4FA] flex items-center justify-center flex-shrink-0">
            <IconTrophy size={20} className="text-[#0099CC]" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-[15px]">Quem vai vencer a Copa 2026?</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">Escolha antes dos jogos começarem</p>
          </div>
        </div>

        {/* Points cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {POSITIONS.map(({ label, pts, Icon, border, ptColor }) => (
            <div key={label} className={`rounded-xl border p-3 text-center ${border}`}>
              <div className="flex justify-center mb-2"><Icon size={32} /></div>
              <div className="text-[11px] font-semibold text-gray-600">{label}</div>
              <div className={`text-[13px] font-bold mt-0.5 ${ptColor}`}>{pts}</div>
            </div>
          ))}
        </div>

        {/* Selects with flags */}
        <div className="space-y-4">
          {[
            { state:champion, set:setChampion, ex1:runner,  ex2:third,   Icon:IconGold,   label:'Campeão',     ptColor:'text-amber-700', pts:'+50 pts' },
            { state:runner,   set:setRunner,   ex1:champion,ex2:third,   Icon:IconSilver, label:'Vice-campeão',ptColor:'text-slate-600', pts:'+25 pts' },
            { state:third,    set:setThird,    ex1:champion,ex2:runner,  Icon:IconBronze, label:'3º lugar',    ptColor:'text-orange-700',pts:'+10 pts' },
          ].map(({ state, set, ex1, ex2, Icon, label, ptColor, pts }) => (
            <div key={label}>
              <label className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                <Icon size={20} />{label}
                <span className={`ml-auto font-bold ${ptColor}`}>{pts}</span>
              </label>
              {/* Show flag of selected team above select */}
              {state && (
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className="text-2xl">{TEAM_FLAGS[state]}</span>
                  <span className="text-[13px] font-semibold text-gray-700">{state}</span>
                </div>
              )}
              <select
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all"
                value={state} onChange={e => set(e.target.value)} disabled={locked}>
                <option value="">Selecione a seleção...</option>
                {exclude(ex1, ex2).map(t => (
                  <option key={t} value={t}>{TEAM_FLAGS[t]} {t}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {locked && (
          <div className="mt-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <IconLock size={16} className="text-amber-600 flex-shrink-0" />
            <span className="text-[13px] text-amber-800 font-medium">Palpites bloqueados — a Copa já começou!</span>
          </div>
        )}

        {!locked && (
          <button onClick={handleSave} disabled={!canSave || saving || saved}
            className="mt-6 w-full py-3.5 rounded-xl font-semibold text-[15px] text-white flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed bg-[#0099CC] hover:bg-[#007aa8] shadow-sm">
            {saved ? <><IconCheck size={18} /> Salvo! Abrindo palpites...</> :
             saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
             <>Salvar e ir para os palpites <IconArrowRight size={16} /></>}
          </button>
        )}

        {locked && (
          <button onClick={() => router.push('/picks')}
            className="mt-5 w-full py-3.5 rounded-xl font-semibold text-[15px] text-white flex items-center justify-center gap-2 bg-[#0099CC] hover:bg-[#007aa8] transition-all">
            Ver palpites dos jogos <IconArrowRight size={16} />
          </button>
        )}

        <div className="text-center mt-4">
          <button onClick={() => router.push('/picks')} className="text-[13px] text-gray-400 hover:text-gray-500 underline underline-offset-2">
            Pular por agora
          </button>
        </div>
      </div>
    </Layout>
  )
}
