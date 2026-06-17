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

export default function TeamFormPopup({ team, size = 44, align = 'center', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<RecentResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isTouch = useRef(false)

  useEffect(() => {
    isTouch.current = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
  }, [])

  // Fecha ao tocar/clicar fora do popup
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [open])

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

  const alignStyle: React.CSSProperties =
    align === 'left'  ? { left: 0 } :
    align === 'right' ? { right: 0 } :
    { left: '50%', transform: 'translateX(-50%)' }

  return (
    <div ref={ref} className="relative" style={{ display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => { if (isTouch.current) (open ? setOpen(false) : handleOpen()) }}
        onMouseEnter={() => { if (!isTouch.current) handleOpen() }}
        onMouseLeave={() => { if (!isTouch.current) setOpen(false) }}
        className="flex flex-col items-center gap-1 bg-transparent border-none p-0 cursor-pointer"
      >
        <FlagImg team={team} size={size} className={className} />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-3"
          style={{ width: 220, ...alignStyle }}
          onMouseEnter={() => { if (!isTouch.current) setOpen(true) }}
          onMouseLeave={() => { if (!isTouch.current) setOpen(false) }}
        >
          <p className="text-[12px] font-bold text-gray-800 mb-0.5">{team}</p>
          <p className="text-[10px] text-gray-400 mb-2">Últimos 5 jogos</p>

          {loading && (
            <div className="flex justify-center py-3">
              <span className="w-4 h-4 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" />
            </div>
          )}

          {!loading && recent && recent.length === 0 && (
            <p className="text-[11px] text-gray-400 py-2">Esta seleção ainda não tem jogos registrados.</p>
          )}

          {!loading && recent && recent.length > 0 && (
            <>
              <div className="flex gap-1.5 mb-2.5">
                {recent.map((r, i) => (
                  <span
                    key={i}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: RESULT_STYLE[r.result].bg, color: RESULT_STYLE[r.result].text }}
                    title={`${fmtDate(r.date)} · ${r.goalsFor}×${r.goalsAgainst} vs ${r.opponent}`}
                  >
                    {r.result}
                  </span>
                ))}
              </div>
              <div className="space-y-1">
                {recent.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] border-t border-gray-100 pt-1 first:border-0 first:pt-0">
                    <span className="text-gray-500 truncate flex-1">vs {r.opponent}</span>
                    <span className="text-gray-800 font-semibold ml-2">{r.goalsFor}-{r.goalsAgainst}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
