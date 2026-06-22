import { useState, useMemo, useEffect } from 'react'
import FlagImg from '@/components/FlagImg'
import type { Match } from '@/lib/supabase'
import { detectGroups, calcGroupTable } from '@/lib/groupStandings'

type Props = {
  matches: Match[]
  overrides: Record<string, string>
  initialLabel: string
  onClose: () => void
}

// Modal de classificação de grupo, aberto ao tocar no selo "Grupo X" no card
// de um jogo (aba Palpites). Reaproveita a mesma lógica de detecção/cálculo
// usada no card Campeão (lib/groupStandings.ts), só que focado num grupo só
// por vez — com os chips no topo pra trocar de grupo sem fechar o modal.
export default function GroupStandingsModal({ matches, overrides, initialLabel, onClose }: Props) {
  const groups = useMemo(() => detectGroups(matches, overrides), [matches, overrides])
  const [activeLabel, setActiveLabel] = useState(initialLabel)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const group = groups.find(g => g.label === activeLabel) || groups[0]
  if (!group) return null
  const standings = calcGroupTable(group)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ background: 'rgba(0,20,40,0.7)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-4 pt-1 pb-2 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-[15px]">Classificação dos grupos</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-4 overflow-y-auto">
          <div className="relative -mx-1 mb-2">
            <div className="flex gap-1.5 overflow-x-auto pb-2 px-1">
              {groups.map(g => (
                <button key={g.label} onClick={() => setActiveLabel(g.label)}
                  className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                    g.label === activeLabel ? 'bg-[#0099CC] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  Grupo {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl overflow-hidden border border-gray-100 mb-3">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left font-medium py-1.5 px-2">Seleção</th>
                  <th className="font-medium py-1.5 px-1 w-6">J</th>
                  <th className="font-medium py-1.5 px-1 w-6">V</th>
                  <th className="font-medium py-1.5 px-1 w-6">E</th>
                  <th className="font-medium py-1.5 px-1 w-6">D</th>
                  <th className="font-medium py-1.5 px-1 w-8">SG</th>
                  <th className="font-medium py-1.5 px-2 w-8">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.team} className={`border-t border-gray-50 ${i < 2 ? 'bg-green-50/50' : ''}`}>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-gray-400 w-3 flex-shrink-0">{i + 1}</span>
                        <FlagImg team={s.team} size={16}/>
                        <span className="truncate font-medium text-gray-800">{s.team}</span>
                      </div>
                    </td>
                    <td className="text-center py-1.5 px-1 text-gray-600">{s.played}</td>
                    <td className="text-center py-1.5 px-1 text-gray-600">{s.won}</td>
                    <td className="text-center py-1.5 px-1 text-gray-600">{s.drawn}</td>
                    <td className="text-center py-1.5 px-1 text-gray-600">{s.lost}</td>
                    <td className="text-center py-1.5 px-1 text-gray-600">{s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}</td>
                    <td className="text-center py-1.5 px-2 font-bold text-gray-900">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mb-4 px-1">Os 2 primeiros de cada grupo avançam de fase</p>
        </div>
      </div>
    </div>
  )
}
