'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, Player } from '@/lib/supabase'

type AuthCtx = {
  player: Player | null
  loading: boolean
  login:    (username: string, password: string) => Promise<{ error?: string }>
  register: (username: string, password: string) => Promise<{ error?: string }>
  logout:   () => void
  isAdmin:  boolean
  refreshPlayer: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  player: null, loading: true,
  login: async () => ({}), register: async () => ({}),
  logout: () => {}, isAdmin: false, refreshPlayer: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [player,  setPlayer]  = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('bolao_player')
    if (saved) {
      try { setPlayer(JSON.parse(saved)) }
      catch { localStorage.removeItem('bolao_player') }
    }
    setLoading(false)
  }, [])

  async function refreshPlayer() {
    if (!player) return
    const { data } = await supabase
      .from('players').select('*').eq('id', player.id).single()
    if (data) {
      setPlayer(data)
      localStorage.setItem('bolao_player', JSON.stringify(data))
    }
  }

  // ── Login ──────────────────────────────────────────────────────
  async function login(username: string, password: string): Promise<{ error?: string }> {
    const clean = username.trim().toLowerCase()
    if (!clean || !password) return { error: 'Preencha usuário e senha.' }

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', clean)
      .maybeSingle()

    if (error)  return { error: 'Erro ao conectar. Tente novamente.' }
    if (!data)  return { error: 'Usuário não encontrado.' }

    // Simple password check via bcrypt stored in column password_hash
    // We do server-side check via RPC
    const { data: ok, error: rpcErr } = await supabase
      .rpc('check_password', { p_username: clean, p_password: password })

    if (rpcErr || !ok) return { error: 'Senha incorreta.' }

    setPlayer(data)
    localStorage.setItem('bolao_player', JSON.stringify(data))
    return {}
  }

  // ── Register ───────────────────────────────────────────────────
  async function register(username: string, password: string): Promise<{ error?: string }> {
    const clean = username.trim().toLowerCase()
    if (!clean)        return { error: 'Informe um usuário.' }
    if (password.length < 6) return { error: 'A senha deve ter pelo menos 6 caracteres.' }

    // Check duplicate
    const { data: existing } = await supabase
      .from('players').select('id').eq('username', clean).maybeSingle()
    if (existing) return { error: 'Este usuário já está em uso. Escolha outro.' }

    const isAdmin = clean === (process.env.NEXT_PUBLIC_ADMIN_NICKNAME ?? '').toLowerCase()

    const { data: created, error } = await supabase
      .rpc('create_player', {
        p_username: clean,
        p_password: password,
        p_is_admin: isAdmin,
      })

    if (error || !created) {
      console.error(error)
      return { error: 'Erro ao criar conta. Tente novamente.' }
    }

    // Fetch full row
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
  }

  const isAdmin =
    player?.is_admin === true ||
    player?.username?.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_NICKNAME ?? '').toLowerCase()

  return (
    <Ctx.Provider value={{ player, loading, login, register, logout, isAdmin, refreshPlayer }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
