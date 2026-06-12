import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getFlagProps } from '@/lib/flags'
import type { Match } from '@/lib/supabase'

function FlagImg({ team, dbFlag, size = 32 }: { team: string; dbFlag?: string; size?: number }) {
  const p = getFlagProps(team, dbFlag)
  if (p.type === 'png' && p.src) {
    return <img src={p.src} alt={p.alt} style={{ width: size, height: size * 0.67, objectFit: 'cover', borderRadius: 2 }}/>
  }
  return <span style={{ fontSize: size * 0.7, lineHeight: 1 }}>{p.value}</span>
}

type PickGroup = {
  home: number; away: number; count: number
  players: { id: string; name: string; avatar?: string; rank?: number; pts: number }[]
}
type GroupData = { total: number; distribution: PickGroup[]; winnerDist: { home: number; draw: number; away: number } }

const COLORS = ['#16A34A','#0099CC','#7C3AED','#EA580C','#0F766E','#B91C1C','#D97706','#0369A1','#BE185D','#1D4ED8']

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
  const av = avatar ? (avatar.startsWith('http') ? avatar : supabase.storage.from('avatars').getPublicUrl(avatar).data.publicUrl) : null
  const color = COLORS[name.charCodeAt(0) % COLORS.length]
  if (av) return <img src={av} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }}/>
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
      style={{ width: size, height: size, background: color, fontSize: size * 0.32 }}>
      {initials(name)}
    </div>
  )
}

function PlayerModal({ group, match, onClose }: { group: PickGroup; match: Match; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0"/>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900">
              {match.home_team} <span className="text-[#0099CC]">{group.home}×{group.away}</span> {match.away_team}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {group.count} {group.count === 1 ? 'pessoa apostou' : 'pessoas apostaram'} neste placar
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {/* List */}
        <div className="overflow-y-auto">
          {group.players.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
              <span className="text-[11px] font-bold text-gray-400 w-6 text-right flex-shrink-0">{i + 1}</span>
              <Avatar name={p.name} avatar={p.avatar} size={34}/>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{p.name}</p>
                <p className="text-[10px] text-gray-400">{p.pts} pts{p.rank ? ` · ${p.rank}º no ranking` : ''}</p>
              </div>
              <div className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                {group.home}×{group.away}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function GroupPicksCard({ match }: { match: Match }) {
  const [data,    setData]    = useState<GroupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<PickGroup | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/picks/group?match_id=${match.id}`)
      if (res.ok) setData(await res.json())
      setLoading(false)
    }
    load()
  }, [match.id])

  const total = data?.total || 0
  const dist  = data?.distribution || []
  const wd    = data?.winnerDist || { home: 0, draw: 0, away: 0 }

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 flex justify-center">
      <span className="w-5 h-5 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
    </div>
  )

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span className="text-[12px] font-semibold text-gray-700">O grupo apostou</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Fechado
          </div>
        </div>

        {/* Match */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <div className="flex flex-col items-center gap-1 flex-1">
            <FlagImg team={match.home_team} dbFlag={match.home_flag} size={36}/>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wide">{match.home_team.slice(0, 8)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] text-gray-400">×</span>
            {match.match_date && <span className="text-[9px] text-gray-400">{new Date(match.match_date).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour:'2-digit', minute:'2-digit' })}</span>}
          </div>
          <div className="flex flex-col items-center gap-1 flex-1">
            <FlagImg team={match.away_team} dbFlag={match.away_flag} size={36}/>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wide">{match.away_team.slice(0, 8)}</span>
          </div>
        </div>

        {/* Winner distribution */}
        {total > 0 && (
          <div className="px-4 pt-3 pb-2">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Quem o grupo acha que vai ganhar</p>
            {[
              { label: match.home_team, count: wd.home, color: '#16A34A' },
              { label: 'Empate',        count: wd.draw, color: '#6B7280' },
              { label: match.away_team, count: wd.away, color: '#DC2626' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-2 mb-1.5">
                <div className="text-[10px] text-gray-600 w-16 truncate flex-shrink-0">{row.label.slice(0, 8)}</div>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full flex items-center px-2" style={{ width: `${Math.max(6, Math.round(row.count / total * 100))}%`, background: row.color }}>
                    {row.count > 0 && <span className="text-[9px] font-bold text-white whitespace-nowrap">{Math.round(row.count / total * 100)}% · {row.count}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Scores */}
        <div className="px-4 pb-2">
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Placares mais apostados — toque para ver quem</p>
          <div className="flex flex-wrap gap-2">
            {dist.slice(0, 8).map((g, i) => (
              <button key={`${g.home}-${g.away}`} onClick={() => setModal(g)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-left transition-all active:scale-95 ${i === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                {i === 0 && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
                  </svg>
                )}
                <span className={`text-[11px] font-bold ${i === 0 ? 'text-green-700' : 'text-gray-700'}`}>{g.home}×{g.away}</span>
                <span className="text-[9px] text-gray-400">{g.count}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Toque em um placar para ver quem apostou
          </p>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50">
          <span className="text-[10px] text-gray-400">Total de palpites</span>
          <span className="text-[11px] font-bold text-gray-700">{total} pessoas</span>
        </div>
      </div>

      {modal && <PlayerModal group={modal} match={match} onClose={() => setModal(null)}/>}
    </>
  )
}
