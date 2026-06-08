'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, Player } from '@/lib/supabase'

type AuthCtx = {
  player: Player | null
  loading: boolean
  login: (nickname: string) => Promise<{ error?: string }>
  logout: () => void
  isAdmin: boolean
}

const Ctx = createContext<AuthCtx>({
  player: null, loading: true,
  login: async () => ({}), logout: () => {},
  isAdmin: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('bolao_player')
    if (saved) {
      try { setPlayer(JSON.parse(saved)) } catch { localStorage.removeItem('bolao_player') }
    }
    setLoading(false)
  }, [])

  async function login(nickname: string): Promise<{ error?: string }> {
    const clean = nickname.trim()
    if (!clean) return { error: 'Digite um apelido.' }

    // Check if already exists
    const { data: existing } = await supabase
      .from('players')
      .select('*')
      .ilike('nickname', clean)
      .single()

    if (existing) {
      setPlayer(existing)
      localStorage.setItem('bolao_player', JSON.stringify(existing))
      return {}
    }

    // Create new player
    const { data: created, error } = await supabase
      .from('players')
      .insert({ nickname: clean, is_admin: clean.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_NICKNAME?.toLowerCase() })
      .select()
      .single()

    if (error || !created) return { error: 'Erro ao entrar. Tente novamente.' }

    setPlayer(created)
    localStorage.setItem('bolao_player', JSON.stringify(created))
    return {}
  }

  function logout() {
    setPlayer(null)
    localStorage.removeItem('bolao_player')
  }

  const isAdmin = player?.is_admin === true ||
    player?.nickname?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_NICKNAME?.toLowerCase()

  return (
    <Ctx.Provider value={{ player, loading, login, logout, isAdmin }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
