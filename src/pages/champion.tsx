import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase, Match } from '@/lib/supabase'
import Layout from '@/components/Layout'
import FlagImg from '@/components/FlagImg'
import CompetitionStatusCard from '@/components/CompetitionStatusCard'

import { TEAMS_SELECT } from '@/lib/flags'
import { detectActivePhase } from '@/lib/groupStandings'

const MAX_CHAMP_EDITS = 3
const PRIZE_PCT = { first: 60, second: 25, third: 15 }
const ENTRY_FEE = 10

// Copa 2026 já encerrada — Espanha campeã
const COPA_ENCERRADA = true
const COPA_CAMPEA    = 'Espanha'
const COPA_VICE      = 'Argentina'
const COPA_TERCEIRO  = 'França'

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function getAvatarUrl(path?: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data?.publicUrl || null
}

function MedalIcon({ pos }: { pos: number }) {
  const emojis = ['🥇','🥈','🥉']
  return <span className="text-[22px]">{emojis[pos] || ''}</span>
}

type Winner = {
  player_id: string
  username: string
  avatar?: string
  pts: number
  pick_champion?: string
  pick_runner?: string
  pick_third?: string
}

export default function ChampionPage() {
  const router = useRouter()
  const { player, loading } = useAuth()
  const [fetching, setFetching] = useState(true)
  const [matches, setMatches] = useState<Match[]>([])
  const [bracketAtivo, setBracketAtivo] = useState(false)
  const [paidCount, setPaidCount] = useState(0)
  const [extraAmount, setExtraAmount] = useState(0)
  const [winners, setWinners] = useState<Winner[]>([])
  // palpite do próprio jogador logado
  const [myPick, setMyPick] = useState<{champion?:string;runner?:string;third?:string} | null>(null)
  const [allPicks, setAllPicks] = useState<{username:string;avatar?:string;champion?:string;runner?:string;third?:string;bonus:number}[]>([])
  const [showAllPicks, setShowAllPicks] = useState(false)

  useEffect(() => { if (!loading && !player) router.push('/') }, [loading, player])

  useEffect(() => {
    if (!player) return
    Promise.all([
      supabase.from('matches').select('*'),
      supabase.from('pix_config').select('bracket_ativo').limit(1),
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('payment_ok', true).eq('is_admin', false),
      supabase.from('prize_config').select('*').limit(1),
      supabase.from('scores').select('player_id,total_pts').order('total_pts', { ascending: false }).limit(3),
      supabase.from('players').select('id,username,avatar').eq('payment_ok', true).eq('is_admin', false),
      supabase.from('champion_picks').select('player_id,pick_champion,pick_runner,pick_third'),
      supabase.from('champion_picks').select('pick_champion,pick_runner,pick_third').eq('player_id', player.id).maybeSingle(),
    ]).then(([{ data: matchRows }, { data: cfg }, { count }, { data: prizeRows }, { data: topScores }, { data: allPlayers }, { data: allPicks }, { data: myPickRow }]) => {
      setMatches((matchRows || []) as Match[])
      setBracketAtivo(cfg?.[0]?.bracket_ativo || false)
      setPaidCount(count || 0)
      if (prizeRows?.[0]) setExtraAmount(Number(prizeRows[0].extra_amount) || 0)
      if (myPickRow) setMyPick({ champion: myPickRow.pick_champion, runner: myPickRow.pick_runner, third: myPickRow.pick_third })

      // Monta top 3 cruzando scores + players + picks
      if (topScores && allPlayers) {
        const pMap: Record<string, { username: string; avatar?: string }> = {}
        ;(allPlayers as {id:string;username:string;avatar?:string}[]).forEach(p => { pMap[p.id] = p })
        const pickMap: Record<string, {pick_champion?:string;pick_runner?:string;pick_third?:string}> = {}
        ;(allPicks || []).forEach((p:any) => { pickMap[p.player_id] = p })

        const top = (topScores as {player_id:string;total_pts:number}[])
          .map(s => ({
            player_id: s.player_id,
            pts: s.total_pts,
            ...(pMap[s.player_id] || {}),
            ...(pickMap[s.player_id] || {}),
          }))
          .filter(w => w.username)
        setWinners(top as Winner[])
      }
      // Monta lista completa de palpites de campeão
      if (allPlayers && allPicks) {
        const pMap: Record<string, {username:string;avatar?:string}> = {}
        ;(allPlayers as {id:string;username:string;avatar?:string}[]).forEach(p => { pMap[p.id] = p })
        const full = (allPicks as {player_id:string;pick_champion?:string;pick_runner?:string;pick_third?:string}[])
          .map(p => ({
            ...(pMap[p.player_id] || {}),
            champion: p.pick_champion,
            runner: p.pick_runner,
            third: p.pick_third,
            bonus: (p.pick_champion === 'Espanha' ? 50 : 0) + (p.pick_runner === 'Argentina' ? 25 : 0) + (p.pick_third === 'França' ? 10 : 0),
          }))
          .filter(p => p.username)
          .sort((a, b) => b.bonus - a.bonus)
        setAllPicks(full)
      }
      setFetching(false)
    })
  }, [player])

  const prizePool   = paidCount * ENTRY_FEE + extraAmount
  const prizeFirst  = Math.floor(prizePool * PRIZE_PCT.first  / 100)
  const prizeSecond = Math.floor(prizePool * PRIZE_PCT.second / 100)
  const prizeThird  = Math.floor(prizePool * PRIZE_PCT.third  / 100)
  const prizes      = [prizeFirst, prizeSecond, prizeThird]

  const activePhase = useMemo(() => detectActivePhase(matches), [matches])
  const showBracket = bracketAtivo || activePhase !== 'Fase de Grupos'

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
    </div>
  )

  function PickBadge({ label, team, correct }: { label: string; team?: string; correct: boolean }) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${correct ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-100'}`}>
        {team && <FlagImg team={team} size={14}/>}
        <div>
          <p className="text-[8.5px] text-gray-400 leading-none">{label}</p>
          <p className={`text-[11px] font-semibold leading-tight ${correct ? 'text-green-700' : 'text-gray-600'}`}>{team || '—'}</p>
        </div>
        {correct && <span className="text-green-500 text-[10px]">✓</span>}
      </div>
    )
  }

  return (
    <Layout title="Bolão Copa 2026 BEL">
      <div className="max-w-md mx-auto px-4 py-5 space-y-4">

        {/* ── Hero da Copa encerrada ──────────────────────── */}
        {COPA_ENCERRADA && (
          <div className="rounded-2xl overflow-hidden shadow-lg"
               style={{ background: 'linear-gradient(135deg, #002D55 0%, #0099CC 60%, #00C6FF 100%)' }}>
            <div className="px-5 pt-5 pb-4 text-center">
              <p className="text-white/70 text-[11px] font-semibold uppercase tracking-widest mb-1">Copa do Mundo 2026 · Encerrada</p>
              <p className="text-white text-[26px] font-black leading-tight mb-3">🏆 Campeã do Mundo</p>
              <div className="flex items-center justify-center gap-3 mb-3">
                <FlagImg team={COPA_CAMPEA} size={48}/>
                <p className="text-white text-[28px] font-black">{COPA_CAMPEA}</p>
              </div>
              <div className="flex justify-center gap-4 text-white/80 text-[12px]">
                <div className="text-center"><p className="text-[10px] text-white/50">Vice</p><div className="flex items-center gap-1"><FlagImg team={COPA_VICE} size={14}/><span className="font-medium">{COPA_VICE}</span></div></div>
                <div className="w-px bg-white/20"/>
                <div className="text-center"><p className="text-[10px] text-white/50">3º lugar</p><div className="flex items-center gap-1"><FlagImg team={COPA_TERCEIRO} size={14}/><span className="font-medium">{COPA_TERCEIRO}</span></div></div>
              </div>
            </div>
          </div>
        )}

        {/* ── Palpite do jogador logado ───────────────────── */}
        {myPick?.champion && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Seu palpite de campeão</p>
            <div className="flex gap-2 flex-wrap">
              <PickBadge label="Campeão" team={myPick.champion} correct={myPick.champion === COPA_CAMPEA}/>
              <PickBadge label="Vice" team={myPick.runner} correct={myPick.runner === COPA_VICE}/>
              <PickBadge label="3º lugar" team={myPick.third} correct={myPick.third === COPA_TERCEIRO}/>
            </div>
          </div>
        )}

        {/* ── Vencedores do Bolão ────────────────────────── */}
        {winners.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9H4a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1h-2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M17 3H7v9a5 5 0 0 0 10 0V3Z"/></svg>
              <p className="text-[13px] font-bold text-gray-800">Vencedores do Bolão</p>
              {prizePool > 0 && <span className="ml-auto text-[11px] font-semibold text-[#0099CC]">Total: {formatBRL(prizePool)}</span>}
            </div>
            <div className="divide-y divide-gray-50">
              {winners.map((w, i) => {
                const initials = w.username?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                const avatarUrl = getAvatarUrl(w.avatar)
                const ringColors = ['ring-amber-400','ring-slate-400','ring-orange-400']
                const bgColors   = ['bg-amber-400','bg-slate-400','bg-orange-400']
                return (
                  <div key={w.player_id} className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-2.5">
                      <MedalIcon pos={i}/>
                      {avatarUrl
                        ? <img src={avatarUrl} alt="" className={`w-10 h-10 rounded-full object-cover ring-2 ${ringColors[i]}`} loading="lazy"/>
                        : <div className={`w-10 h-10 rounded-full ${bgColors[i]} flex items-center justify-center text-white text-[12px] font-bold ring-2 ${ringColors[i]}`}>{initials}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[14px] text-gray-900 truncate">{w.username}</p>
                        <p className="text-[11px] text-gray-400">{w.pts} pts</p>
                      </div>
                      {prizePool > 0 && prizes[i] > 0 && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-[16px] font-black text-[#0099CC]">{formatBRL(prizes[i])}</p>
                          <p className="text-[10px] text-gray-400">{i===0?'1º':i===1?'2º':'3º'} lugar</p>
                        </div>
                      )}
                    </div>
                    {/* Palpites do vencedor */}
                    <div className="flex gap-1.5 flex-wrap">
                      <PickBadge label="Campeão" team={w.pick_champion} correct={w.pick_champion === COPA_CAMPEA}/>
                      <PickBadge label="Vice" team={w.pick_runner} correct={w.pick_runner === COPA_VICE}/>
                      <PickBadge label="3º lugar" team={w.pick_third} correct={w.pick_third === COPA_TERCEIRO}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}


        {/* ── Palpites de campeão de todos ──────────────── */}
        {allPicks.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <button onClick={() => setShowAllPicks(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <p className="text-[13px] font-bold text-gray-800">Palpites de campeão — todos</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: showAllPicks ? 'rotate(180deg)' : 'none', transition:'transform 0.2s'}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showAllPicks && (
              <div className="border-t border-gray-50 divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {/* Cabeçalho */}
                <div className="grid grid-cols-[1fr_auto] px-4 py-2 bg-gray-50">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Jogador · Palpites</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Bônus</p>
                </div>
                {allPicks.map((p, i) => {
                  const avatarUrl = getAvatarUrl(p.avatar)
                  const initials = p.username?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                      {avatarUrl
                        ? <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" loading="lazy"/>
                        : <div className="w-8 h-8 rounded-full bg-[#0099CC]/10 flex items-center justify-center text-[#0099CC] text-[11px] font-bold flex-shrink-0">{initials}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-gray-800 truncate">{p.username}</p>
                        <div className="flex gap-1.5 mt-0.5 flex-wrap">
                          {[{t:p.champion,c:'Espanha'},{t:p.runner,c:'Argentina'},{t:p.third,c:'França'}].map((item, j) => item.t ? (
                            <span key={j} className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${item.t===item.c ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                              <FlagImg team={item.t} size={10}/>
                              {item.t}
                              {item.t===item.c && <span className="text-green-500">✓</span>}
                            </span>
                          ) : null)}
                        </div>
                      </div>
                      <span className={`text-[13px] font-black flex-shrink-0 ${p.bonus > 0 ? 'text-amber-500' : 'text-gray-300'}`}>
                        {p.bonus > 0 ? `+${p.bonus}` : '0'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Chaveamento / Grupos ────────────────────────── */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => {}}
            className="flex-1 py-1.5 text-[12px] font-semibold rounded-lg bg-white text-[#0099CC] shadow-sm">
            {showBracket ? 'Chaveamento' : 'Grupos da Copa'}
          </button>
        </div>
        <CompetitionStatusCard matches={matches}/>

      </div>
    </Layout>
  )
}
