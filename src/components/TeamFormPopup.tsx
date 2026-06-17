import { useState, useEffect, useRef } from 'react'
import FlagImg from '@/components/FlagImg'

type RecentResult = {
  date: string
  opponent: string
  goalsFor: number
  goalsAgainst: number
  result: 'V' | 'E' | 'D'
  competition: string
}

type Props = {
  team: string
  size?: number
  align?: 'left' | 'right' | 'center'
  className?: string
}

const RESULT_STYLE: Record<string, { bg: string; text: string }> = {
  V: { bg: '#DCFCE7', text: '#15803D' },
  E: { bg: '#F3F4F6', text: '#4B5563' },
  D: { bg: '#FEE2E2', text: '#B91C1C' },
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch { return '' }
}

// Cache em memória do client durante a sessão — evita rebater a mesma rota
// /api/team-form repetidas vezes ao abrir/fechar o popup da mesma seleção.
const sessionCache: Record<string, RecentResult[] | 'loading' | 'empty'> = {}

function TeamFormModal({ team, recent, loading, onClose }: {
  team: string; recent: RecentResult[] | null; loading: boolean; onClose: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[300px] p-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FlagImg team={team} size={28} />
            <p className="text-[14px] font-bold text-gray-900">{team}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mb-2">Últimos 5 jogos</p>

        {loading && (
          <div className="flex justify-center py-4">
            <span className="w-5 h-5 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
          </div>
        )}

        {!loading && recent && recent.length === 0 && (
          <p className="text-[12px] text-gray-400 py-3">Esta seleção ainda não tem jogos registrados.</p>
        )}

        {!loading && recent && recent.length > 0 && (
          <>
            <div className="flex gap-1.5 mb-3">
              {recent.map((r, i) => (
                <span
                  key={i}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ background: RESULT_STYLE[r.result].bg, color: RESULT_STYLE[r.result].text }}
                  title={`${fmtDate(r.date)} · ${r.goalsFor}×${r.goalsAgainst} vs ${r.opponent}`}
                >
                  {r.result}
                </span>
              ))}
            </div>
            <div className="space-y-1.5">
              {recent.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[12px] rounded-lg px-2.5 py-1.5"
                  style={{ background: RESULT_STYLE[r.result].bg }}
                >
                  <span className="truncate flex-1" style={{ color: RESULT_STYLE[r.result].text }}>vs {r.opponent}</span>
                  <span className="font-bold ml-2" style={{ color: RESULT_STYLE[r.result].text }}>{r.goalsFor}-{r.goalsAgainst}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function TeamFormPopup({ team, size = 44, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<RecentResult[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadForm() {
    const cached = sessionCache[team]
    if (cached && cached !== 'loading') {
      setRecent(cached === 'empty' ? [] : cached)
      return
    }
    if (cached === 'loading') return
    sessionCache[team] = 'loading'
    setLoading(true)
    try {
      const res = await fetch(`/api/team-form?team=${encodeURIComponent(team)}`)
      const data = await res.json()
      const list: RecentResult[] = data?.recent || []
      sessionCache[team] = list.length ? list : 'empty'
      setRecent(list)
    } catch {
      sessionCache[team] = 'empty'
      setRecent([])
    }
    setLoading(false)
  }

  function handleOpen() {
    setOpen(true)
    if (recent === null) loadForm()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex flex-col items-center gap-1 bg-transparent border-none p-0 cursor-pointer"
      >
        <FlagImg team={team} size={size} className={className} />
      </button>

      {open && (
        <TeamFormModal team={team} recent={recent} loading={loading} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
