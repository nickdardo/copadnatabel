'use client'
import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase, Player } from '@/lib/supabase'

type AuthCtx = {
  player:        Player | null
  loading:       boolean
  login:         (username: string, password: string) => Promise<{ error?: string }>
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

export function AuthProvider({ children }: React.PropsWithChildren<{}>) {
  const [player,  setPlayer]  = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('bolao_player')
    if (saved) {
      try { setPlayer(JSON.parse(saved)) }
      catch { localStorage.removeItem('bolao_player') }
    }
    setLoading(false)
  }, [])

  // Heartbeat: update last_seen_at every 30s via API (bypasses RLS)
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

    ping() // immediate on login / page load
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
    const { data } = await supabase
      .from('players').select('*').eq('id', player.id).single()
    if (data) {
      setPlayer(data)
      localStorage.setItem('bolao_player', JSON.stringify(data))
    }
  }

  async function login(username: string, password: string): Promise<{ error?: string }> {
    const clean = username.trim().toLowerCase()
    if (!clean || !password) return { error: 'Preencha usuário e senha.' }

    const { data: ok, error: rpcErr } = await supabase
      .rpc('check_password', { p_username: clean, p_password: password })

    if (rpcErr) return { error: 'Erro ao conectar. Tente novamente.' }
    if (!ok)    return { error: 'Usuário ou senha incorretos.' }

    const { data } = await supabase
      .from('players').select('*').eq('username', clean).single()

    if (!data) return { error: 'Usuário não encontrado.' }

    setPlayer(data)
    localStorage.setItem('bolao_player', JSON.stringify(data))
    return {}
  }

  async function register(username: string, password: string): Promise<{ error?: string }> {
    const clean = username.trim().toLowerCase()
    if (!clean)            return { error: 'Informe um usuário.' }
    if (clean === 'admin') return { error: 'Este usuário não está disponível.' }
    if (password.length < 6) return { error: 'A senha deve ter pelo menos 6 caracteres.' }

    const { data: existing } = await supabase
      .from('players').select('id').eq('username', clean).maybeSingle()
    if (existing) return { error: 'Este usuário já está em uso. Escolha outro.' }

    const { data: newId, error } = await supabase.rpc('create_player', {
      p_username: clean,
      p_password: password,
      p_is_admin: false,
    })

    if (error || !newId) {
      console.error(error)
      return { error: 'Erro ao criar conta. Tente novamente.' }
    }

    const { data: row } = await supabase
      .from('players').select('*').eq('username', clean).single()

    if (!row) return { error: 'Erro inesperado. Tente novamente.' }
    setPlayer(row)
    localStorage.setItem('bolao_player', JSON.stringify(row))
    return {}
  }

  function logout() {
    setPlayer(null)
    localStorage.removeItem('bolao_player')
    // Only clear saved credentials if remember me was not set
    if (localStorage.getItem('bolao_remember') !== '1') {
      localStorage.removeItem('bolao_saved_user')
    }
  }

  const isAdmin = player?.is_admin === true

  return (
    <Ctx.Provider value={{ player, loading, login, register, logout, isAdmin, refreshPlayer }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
