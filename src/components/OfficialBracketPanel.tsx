import { useState, useEffect, useMemo } from 'react'
import { supabase, Match } from '@/lib/supabase'
import BracketChart from '@/components/BracketChart'
import { buildBracketContext, type OfficialSlot } from '@/lib/officialBracket2026'

// Painel automático do chaveamento — usa a estrutura oficial da FIFA
// (lib/officialBracket2026.ts) pra ir resolvendo os times de cada confronto
// conforme a classificação dos grupos e os próprios jogos do mata-mata vão
// terminando. O admin só confirma e cria o confronto real (ou vincula um
// jogo que a Odds API já sincronizou) quando os dois times já são
// conhecidos. Renderizado como chave horizontal (BracketChart), igual ao
// site oficial da FIFA — arraste pra ver as fases.
export default function OfficialBracketPanel() {
  const [matches, setMatches] = useState<Match[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [creatingMatch, setCreatingMatch] = useState<number | null>(null)
  const [pickedThird, setPickedThird] = useState<Record<number, string>>({})
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: m }, { data: o }] = await Promise.all([
      supabase.from('matches').select('*'),
      supabase.from('team_group_overrides').select('team_name, group_label'),
    ])
    setMatches(m || [])
    const map: Record<string, string> = {}
    ;(o || []).forEach((r: { team_name: string; group_label: string }) => { map[r.team_name] = r.group_label })
    setOverrides(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const ctx = useMemo(() => buildBracketContext(matches, overrides), [matches, overrides])

  // Jogos que a Odds API já sincronizou pra essa fase, mas que ainda não
  // foram vinculados a um número oficial. Usado pra reconhecer um confronto
  // que já existe, em vez de oferecer criar um duplicado.
  function findSyncedMatch(fase: string, homeTeam: string, awayTeam: string): Match | undefined {
    return matches.find(m =>
      m.fase === fase && !m.official_match_number &&
      ((m.home_team === homeTeam && m.away_team === awayTeam) ||
       (m.home_team === awayTeam && m.away_team === homeTeam))
    )
  }

  async function linkMatch(slot: OfficialSlot, existingMatch: Match) {
    setCreatingMatch(slot.match)
    setErrMsg(null)
    try {
      const res = await fetch('/api/admin/set-bracket-side', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: existingMatch.id, bracket_side: slot.side, official_match_number: slot.match }),
      })
      if (res.ok) await load()
      else { const j = await res.json(); setErrMsg(j.error || 'Erro ao vincular.') }
    } catch { setErrMsg('Erro de conexão.') }
    setCreatingMatch(null)
  }

  async function createMatch(slot: OfficialSlot, homeTeam: string, awayTeam: string) {
    setCreatingMatch(slot.match)
    setErrMsg(null)
    try {
      const res = await fetch('/api/admin/create-knockout-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fase: slot.fase, home_team: homeTeam, away_team: awayTeam,
          bracket_side: slot.side, match_date: slot.dateHint || null,
          official_match_number: slot.match,
        }),
      })
      if (res.ok) await load()
      else { const j = await res.json(); setErrMsg(j.error || 'Erro ao criar.') }
    } catch { setErrMsg('Erro de conexão.') }
    setCreatingMatch(null)
  }

  return (
    <div className="bg-white border border-green-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-[13px] font-bold text-gray-800">Chaveamento automático — oficial FIFA 2026</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
          Resolve os confrontos sozinho, usando a classificação dos grupos e os jogos do mata-mata já encerrados.
          O 3º colocado é calculado só por pontos/saldo/gols (sem critério de fair play da FIFA). Em caso de mais
          de um candidato possível, escolha manualmente. Arraste pra ver as fases — toque em "Criar" ou "Vincular"
          quando os dois times já estiverem definidos.
        </p>
      </div>

      {errMsg && <p className="text-[12px] font-medium text-red-600">{errMsg}</p>}
      {loading && <p className="text-[12px] text-gray-400">Carregando...</p>}

      {!loading && (
        <BracketChart
          ctx={ctx}
          editable
          pickedThird={pickedThird}
          onPickThird={(key, value) => setPickedThird(p => ({ ...p, [key]: value }))}
          onCreate={createMatch}
          onLink={linkMatch}
          creatingMatch={creatingMatch}
          findSyncedMatch={findSyncedMatch}
        />
      )}
    </div>
  )
}
