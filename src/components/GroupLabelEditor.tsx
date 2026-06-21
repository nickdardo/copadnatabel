import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import FlagImg from '@/components/FlagImg'
import { ALL_TEAMS_BY_GROUP_2026 } from '@/lib/groupStandings'

const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('')

export default function GroupLabelEditor() {
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  async function loadOverrides() {
    const { data } = await supabase.from('team_group_overrides').select('team_name, group_label')
    if (data) {
      const map: Record<string, string> = {}
      data.forEach((r: { team_name: string; group_label: string }) => { map[r.team_name] = r.group_label })
      setOverrides(map)
    }
  }

  useEffect(() => { loadOverrides() }, [])

  // Letra efetiva de cada time: override do admin (se houver) > grupo oficial
  const teamsByGroup: Record<string, string[]> = {}
  Object.entries(ALL_TEAMS_BY_GROUP_2026).forEach(([defaultLabel, teams]) => {
    teams.forEach(team => {
      const label = overrides[team] || defaultLabel
      if (!teamsByGroup[label]) teamsByGroup[label] = []
      teamsByGroup[label].push(team)
    })
  })
  Object.values(teamsByGroup).forEach(list => list.sort())

  async function changeGroup(team: string, newLabel: string) {
    setSaving(team)
    setSavedMsg(null)
    try {
      const res = await fetch('/api/admin/set-group-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_name: team, group_label: newLabel }),
      })
      if (res.ok) {
        setSavedMsg(`${team} movido para o Grupo ${newLabel}`)
        await loadOverrides()
      } else {
        const json = await res.json()
        setSavedMsg(json.error || 'Erro ao salvar.')
      }
    } catch {
      setSavedMsg('Erro de conexão.')
    }
    setSaving(null)
    setTimeout(() => setSavedMsg(null), 3000)
  }

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-[13px] font-bold text-gray-800">Grupos da Copa — editar seleção por seleção</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
          Já vem pré-carregado com a distribuição oficial da FIFA. Se algum time mudar de grupo
          (ex: desistência/substituição), troque aqui — vale só para essa seleção, sem afetar as demais.
        </p>
      </div>

      {savedMsg && <p className="text-[12px] font-medium text-green-700">{savedMsg}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {GROUP_LETTERS.map(letter => (
          <div key={letter} className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Grupo {letter}</p>
            <div className="space-y-1">
              {(teamsByGroup[letter] || []).map(team => (
                <div key={team} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5">
                  <FlagImg team={team} size={16}/>
                  <span className="text-[12px] text-gray-800 flex-1 truncate">{team}</span>
                  <select
                    value={letter}
                    onChange={e => changeGroup(team, e.target.value)}
                    disabled={saving === team}
                    className="text-[11px] font-semibold border border-gray-200 rounded-md px-1.5 py-1 bg-white text-gray-700 flex-shrink-0">
                    {GROUP_LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              ))}
              {(teamsByGroup[letter] || []).length === 0 && (
                <p className="text-[11px] text-gray-400 px-2 py-1">Nenhuma seleção</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
