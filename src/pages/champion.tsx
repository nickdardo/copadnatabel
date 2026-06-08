'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, ChampionPick } from '@/lib/supabase'
import Layout from '@/components/Layout'

// All 48 qualified teams for 2026 World Cup
const TEAMS = [
  '🇦🇷 Argentina','🇧🇷 Brasil','🇫🇷 França','🇪🇸 Espanha','🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra',
  '🇵🇹 Portugal','🇩🇪 Alemanha','🇳🇱 Países Baixos','🇺🇾 Uruguai','🇧🇪 Bélgica',
  '🇺🇸 Estados Unidos','🇲🇽 México','🇨🇦 Canadá','🇯🇵 Japão','🇰🇷 Coreia do Sul',
  '🇲🇦 Marrocos','🇸🇳 Senegal','🇨🇴 Colômbia','🇨🇱 Chile','🇪🇨 Equador',
  '🇵🇪 Peru','🇩🇰 Dinamarca','🇦🇹 Áustria','🇨🇭 Suíça','🇭🇷 Croácia',
  '🇷🇸 Sérvia','🇷🇴 Romênia','🇸🇮 Eslovênia','🇦🇱 Albânia','🇹🇷 Turquia',
  '🇰🇿 Cazaquistão','🇬🇪 Geórgia','🇮🇹 Itália','🇸🇦 Arábia Saudita',
  '🇦🇺 Austrália','🇳🇬 Nigéria','🇨🇲 Camarões','🇨🇿 Tchéquia','🇸🇰 Eslováquia',
  '🇭🇺 Hungria','🇸🇪 Suécia','🇳🇴 Noruega','🇮🇱 Israel','🇮🇶 Iraque',
  '🇮🇷 Irã','🇳🇿 Nova Zelândia','🇲🇿 Moçambique','🇨🇩 RD Congo',
].sort()

export default function ChampionPage() {
  const { player, loading } = useAuth()
  const router = useRouter()

  const [champion, setChampion] = useState('')
  const [runner, setRunner]     = useState('')
  const [third, setThird]       = useState('')
  const [locked, setLocked]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !player) router.push('/')
  }, [loading, player])

  useEffect(() => {
    if (!player) return
    supabase
      .from('champion_picks')
      .select('*')
      .eq('player_id', player.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setChampion(data.pick_champion)
          setRunner(data.pick_runner)
          setThird(data.pick_third)
          setLocked(data.locked)
        }
        setFetching(false)
      })
  }, [player])

  async function handleSave() {
    if (!player || !champion || !runner || !third) return
    if (champion === runner || champion === third || runner === third) return
    setSaving(true)

    await supabase.from('champion_picks').upsert({
      player_id: player.id,
      pick_champion: champion,
      pick_runner: runner,
      pick_third: third,
    }, { onConflict: 'player_id' })

    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      router.push('/picks')
    }, 1200)
  }

  const available = (exclude1: string, exclude2: string) =>
    TEAMS.filter(t => t !== exclude1 && t !== exclude2)

  const canSave = champion && runner && third &&
    champion !== runner && champion !== third && runner !== third

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-[#1D9E75]/30 border-t-[#1D9E75] rounded-full animate-spin" />
    </div>
  )

  return (
    <Layout title="Palpite de Campeão" step={1}>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-[#E1F5EE] flex items-center justify-center text-xl">🏆</div>
            <div>
              <h2 className="font-semibold text-gray-900">Quem vai vencer a Copa 2026?</h2>
              <p className="text-xs text-gray-400">Escolha antes dos jogos começarem</p>
            </div>
          </div>
        </div>

        {/* Pontuation explanation */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { emoji: '🥇', label: 'Campeão', pts: '+50 pts', color: 'bg-amber-50 border-amber-200' },
            { emoji: '🥈', label: 'Vice',    pts: '+25 pts', color: 'bg-gray-50 border-gray-200' },
            { emoji: '🥉', label: '3º lugar',pts: '+10 pts', color: 'bg-orange-50 border-orange-200' },
          ].map(item => (
            <div key={item.label} className={`rounded-2xl border p-3 text-center ${item.color}`}>
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="text-xs font-medium text-gray-700">{item.label}</div>
              <div className="text-sm font-bold text-gray-900">{item.pts}</div>
            </div>
          ))}
        </div>

        {/* Selects */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              🥇 Campeão <span className="text-[#1D9E75] font-bold">+50 pts</span>
            </label>
            <select
              className="input"
              value={champion}
              onChange={e => setChampion(e.target.value)}
              disabled={locked}
            >
              <option value="">Selecione...</option>
              {available(runner, third).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              🥈 Vice-campeão <span className="text-blue-600 font-bold">+25 pts</span>
            </label>
            <select
              className="input"
              value={runner}
              onChange={e => setRunner(e.target.value)}
              disabled={locked}
            >
              <option value="">Selecione...</option>
              {available(champion, third).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              🥉 Terceiro lugar <span className="text-orange-600 font-bold">+10 pts</span>
            </label>
            <select
              className="input"
              value={third}
              onChange={e => setThird(e.target.value)}
              disabled={locked}
            >
              <option value="">Selecione...</option>
              {available(champion, runner).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {locked && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            🔒 Palpites de campeão bloqueados. A Copa já começou!
          </div>
        )}

        {!locked && (
          <button
            onClick={handleSave}
            disabled={!canSave || saving || saved}
            className="btn btn-primary w-full justify-center mt-6 py-3 text-base"
          >
            {saved    ? '✅ Salvo! Indo para os jogos...' :
             saving   ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
             '⚽ Salvar e ir para os palpites'}
          </button>
        )}

        {locked && (
          <button
            onClick={() => router.push('/picks')}
            className="btn btn-primary w-full justify-center mt-6 py-3 text-base"
          >
            Ver palpites dos jogos →
          </button>
        )}

        <div className="text-center mt-4">
          <button
            onClick={() => router.push('/picks')}
            className="text-sm text-gray-400 underline underline-offset-2"
          >
            Pular por agora
          </button>
        </div>
      </div>
    </Layout>
  )
}
