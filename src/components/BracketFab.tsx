import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase, Match } from '@/lib/supabase'
import { buildBracketContext } from '@/lib/officialBracket2026'
import { BracketFullscreenModal } from '@/components/BracketChart'

const STORAGE_KEY = 'bracket_fab_pos'

// Botão flutuante arrastável, disponível em todas as telas (vive no
// Layout, não em uma página específica) — dá acesso rápido ao chaveamento
// completo de qualquer lugar do app, sem precisar trocar de aba e perder
// o que estava fazendo. Continua valioso mesmo depois que a tela Campeão
// passa a mostrar a chave automaticamente, porque nas outras abas
// (Palpites, Ranking, Assistir, Regras) não tem outro jeito rápido de
// espiar o chaveamento. Sempre visível, mesmo só com fórmula ("Vencedor
// Grupo A"). A posição que o jogador arrastar fica salva (localStorage).
export default function BracketFab() {
  const [matches, setMatches] = useState<Match[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })
  const origRef = useRef({ x: 0, y: 0 })
  const posRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    supabase.from('matches').select('*').then(({ data }) => { if (data) setMatches(data) })
    supabase.from('team_group_overrides').select('team_name, group_label').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((r: { team_name: string; group_label: string }) => { map[r.team_name] = r.group_label })
        setOverrides(map)
      }
    })
  }, [])

  useEffect(() => {
    let initial = { x: window.innerWidth - 66, y: Math.round(window.innerHeight * 0.32) }
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) initial = JSON.parse(saved)
    } catch {}
    setPos(initial)
    posRef.current = initial
  }, [])

  const ctx = useMemo(() => buildBracketContext(matches, overrides), [matches, overrides])

  function getXY(e: MouseEvent | TouchEvent) {
    if ('touches' in e && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    const me = e as MouseEvent
    return { x: me.clientX, y: me.clientY }
  }

  function onDown(e: React.MouseEvent | React.TouchEvent) {
    draggingRef.current = true
    movedRef.current = false
    const p = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }
    startRef.current = p
    origRef.current = posRef.current || { x: 0, y: 0 }
  }

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!draggingRef.current) return
      const p = getXY(e)
      const dx = p.x - startRef.current.x
      const dy = p.y - startRef.current.y
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true
      const newX = Math.max(4, Math.min(window.innerWidth - 56, origRef.current.x + dx))
      const newY = Math.max(56, Math.min(window.innerHeight - 130, origRef.current.y + dy))
      const next = { x: newX, y: newY }
      posRef.current = next
      setPos(next)
    }
    function onUp() {
      if (!draggingRef.current) return
      draggingRef.current = false
      if (movedRef.current) {
        try { if (posRef.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current)) } catch {}
      } else {
        setOpen(true)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  if (!pos) return null

  return (
    <>
      <button
        onMouseDown={onDown}
        onTouchStart={onDown}
        aria-label="Ver chaveamento mata-mata"
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 40, touchAction: 'none' }}
        className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform bracket-fab-pulse">
        <img src="/copa2026-logo.jpg" alt="" className="w-12 h-12 rounded-full object-cover pointer-events-none"/>
      </button>
      {open && <BracketFullscreenModal ctx={ctx} onClose={() => setOpen(false)}/>}
    </>
  )
}
