import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import FlagImg from '@/components/FlagImg'
import type { Match } from '@/lib/supabase'
import { detectGroups } from '@/lib/groupStandings'

const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('')

export default function GroupLabelEditor({ matches }: { matches: Match[] }) {
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

  const groups = detectGroups(matches, overrides)

  async function saveLabel(teams: string[], label: string) {
    setSaving(teams.join('|'))
    setSavedMsg(null)
    try {
      const res = await fetch('/api/admin/set-group-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams, group_label: label }),
      })
      if (res.ok) {
        setSavedMsg(`Grupo ${label} salvo!`)
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

  if (groups.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-[12px] text-gray-400">Os grupos aparecem aqui assim que os jogos da fase de grupos forem cadastrados.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-[13px] font-bold text-gray-800">Corrigir letra dos grupos</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
          O app já identifica corretamente quais 4 seleções jogam entre si, mas a letra (A, B, C...) pode não bater
          com a oficial da FIFA. Confira na fonte oficial e corrija aqui — vale para os 4 times do grupo de uma vez.
        </p>
      </div>

      {savedMsg && <p className="text-[12px] font-medium text-green-700">{savedMsg}</p>}

      <div className="space-y-2">
        {groups.map(g => {
          const key = g.teams.join('|')
          return (
            <div key={key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
                {g.teams.map(t => (
                  <span key={t} className="flex items-center gap-1 text-[11px] text-gray-700">
                    <FlagImg team={t} size={14}/>{t}
                  </span>
                ))}
              </div>
              <select
                value={g.label}
                onChange={e => saveLabel(g.teams, e.target.value)}
                disabled={saving === key}
                className="text-[12px] font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-800 flex-shrink-0">
                {GROUP_LETTERS.map(l => <option key={l} value={l}>Grupo {l}</option>)}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
