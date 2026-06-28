'use client'
import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase, Player } from '@/lib/supabase'

type AuthCtx = {
  player:        Player | null
  loading:       boolean
  login:         (username: string, password: string, remember: boolean) => Promise<{ error?: string }>
  register:      (username: string, password: string) => Promise<{ error?: string }>
  logout:        () => void
  isAdmin:       boolean
  refreshPlayer: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  player: null, loading: true,
  login: async () => ({}), register: async () => ({}),
  logout: () => {}, isAdmin: false, refreshPlayer: async () => {},
})

function saveToStorage(player: Player) {
  const json = JSON.stringify(player)
  try { localStorage.setItem('bolao_player', json) } catch {}
  try { sessionStorage.setItem('bolao_player', json) } catch {}
}

function clearStorage() {
  try { localStorage.removeItem('bolao_player') } catch {}
  try { sessionStorage.removeItem('bolao_player') } catch {}
  try { localStorage.removeItem('bolao_remember') } catch {}
  try { localStorage.removeItem('bolao_saved_user') } catch {}
  try { localStorage.removeItem('bolao_saved_pass') } catch {}
}

function loadFromStorage(): Player | null {
  try {
    const s = localStorage.getItem('bolao_player') || sessionStorage.getItem('bolao_player')
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function AuthProvider({ children }: React.PropsWithChildren<{}>) {
  const [player,  setPlayer]  = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // On mount — try storage first, then validate session cookie via API
  useEffect(() => {
    async function init() {
      // 1. Try localStorage/sessionStorage (fastest — works most of the time)
      const stored = loadFromStorage()
      if (stored) {
        setPlayer(stored)
        setLoading(false)
        // Silently validate session cookie in background
        validateSession().then(p => { if (p) { setPlayer(p); saveToStorage(p) } })
        return
      }

      // 2. Try session cookie (PWA install / Safari cleared localStorage)
      const p = await validateSession()
      if (p) {
        setPlayer(p)
        saveToStorage(p)
        setLoading(false)
        return
      }

      // 3. Try saved credentials (user had "Permanecer conectado" checked)
      try {
        const remember  = typeof localStorage !== 'undefined' && localStorage.getItem('bolao_remember') === '1'
        const savedUser = typeof localStorage !== 'undefined' && localStorage.getItem('bolao_saved_user')
        const savedPass = typeof localStorage !== 'undefined' && localStorage.getItem('bolao_saved_pass')
        if (remember && savedUser && savedPass) {
          const { data: ok } = await import('@/lib/supabase').then(m =>
            m.supabase.rpc('check_password', { p_username: savedUser, p_password: (() => { try { return atob(savedPass) } catch { return '' } })() })
          )
          if (ok) {
            const { supabase } = await import('@/lib/supabase')
            const { data: row } = await supabase.from('players').select('*').eq('username', savedUser).single()
            if (row) {
              setPlayer(row)
              saveToStorage(row)
              // Recreate session cookie
              await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ player_id: row.id }),
              }).catch(() => {})
            }
          }
        }
      } catch {}

      setLoading(false)
    }
    init()
  }, [])

  async function validateSession(): Promise<Player | null> {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      if (!res.ok) return null
      const { player } = await res.json()
      return player || null
    } catch { return null }
  }

  // Heartbeat — keep last_seen_at fresh
  useEffect(() => {
    if (!player) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      return
    }
    async function ping() {
      if (!player) return
      try {
        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_id: player.id }),
        })
      } catch {}
    }
    ping()
    heartbeatRef.current = setInterval(ping, 30_000)
    function onVisible() { if (!document.hidden) ping() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [player?.id])

  async function refreshPlayer() {
    if (!player) return
    const { data } = await supabase.from('players').select('*').eq('id', player.id).single()
    if (data) { setPlayer(data); saveToStorage(data) }
  }

  async function login(username: string, password: string, remember: boolean): Promise<{ error?: string }> {
    const clean = username.trim().toLowerCase()
    if (!clean || !password) return { error: 'Preencha usuário e senha.' }

    const { data: ok, error: rpcErr } = await supabase.rpc('check_password', { p_username: clean, p_password: password })
    if (rpcErr) return { error: 'Erro ao conectar. Tente novamente.' }
    if (!ok)    return { error: 'Usuário ou senha incorretos.' }

    const { data } = await supabase.from('players').select('*').eq('username', clean).single()
    if (!data) return { error: 'Usuário não encontrado.' }

    setPlayer(data)
    saveToStorage(data)

    // Cookie de sessão — necessário pra qualquer rota autenticada do admin
    // (fix-pick, finish-match, set-group-label, set-bracket-side etc).
    // Antes só era criado quando "remember" estava marcado, o que deixava
    // essas ferramentas inacessíveis pro próprio admin se ele logasse sem
    // marcar essa caixinha. Agora todo login estabelece o cookie, sempre.
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ player_id: data.id }),
      })
    } catch {}

    if (remember) {
      // Save username hint for next time
      try { localStorage.setItem('bolao_remember', '1') } catch {}
      try { localStorage.setItem('bolao_saved_user', clean) } catch {}
    }

    return {}
  }

  async function register(username: string, password: string): Promise<{ error?: string }> {
    const clean = username.trim().toLowerCase()
    if (!clean)              return { error: 'Informe um usuário.' }
    if (clean === 'admin')   return { error: 'Este usuário não está disponível.' }
    if (password.length < 6) return { error: 'A senha deve ter pelo menos 6 caracteres.' }

    const { data: existing } = await supabase.from('players').select('id').eq('username', clean).maybeSingle()
    if (existing) return { error: 'Este usuário já está em uso. Escolha outro.' }

    const { data: newId, error } = await supabase.rpc('create_player', { p_username: clean, p_password: password, p_is_admin: false })
    if (error || !newId) { console.error(error); return { error: 'Erro ao criar conta. Tente novamente.' } }

    const { data: row } = await supabase.from('players').select('*').eq('username', clean).single()
    if (!row) return { error: 'Erro inesperado. Tente novamente.' }

    setPlayer(row)
    saveToStorage(row)
    // Create session for new users automatically
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ player_id: row.id }),
      })
    } catch {}
    return {}
  }

  function logout() {
    setPlayer(null)
    clearStorage()
    // Revoke session cookie
    fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' }).catch(() => {})
  }

  const isAdmin = player?.is_admin === true

  return (
    <Ctx.Provider value={{ player, loading, login, register, logout, isAdmin, refreshPlayer }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
