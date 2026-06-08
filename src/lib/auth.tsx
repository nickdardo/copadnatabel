'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, Player } from '@/lib/supabase'

type AuthCtx = {
  player: Player | null
  loading: boolean
  login: (name: string) => Promise<{ error?: string }>
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

  async function login(name: string): Promise<{ error?: string }> {
    const clean = name.trim()
    if (!clean) return { error: 'Informe seu nome.' }

    // Check if already exists (case-insensitive)
    const { data: existing, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .ilike('nickname', clean)
      .maybeSingle()

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError)
      return { error: 'Erro ao conectar com o servidor. Verifique sua conexão.' }
    }

    if (existing) {
      setPlayer(existing)
      localStorage.setItem('bolao_player', JSON.stringify(existing))
      return {}
    }

    // Create new player
    const isAdmin = clean.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_NICKNAME ?? '').toLowerCase()
    const { data: created, error: insertError } = await supabase
      .from('players')
      .insert({ nickname: clean, is_admin: isAdmin })
      .select()
      .single()

    if (insertError) {
      console.error('Supabase insert error:', insertError)
      if (insertError.code === '42P01') {
        return { error: 'Tabelas não encontradas. O schema SQL precisa ser executado no Supabase.' }
      }
      return { error: 'Erro ao criar seu perfil. Tente novamente.' }
    }

    if (!created) return { error: 'Erro inesperado. Tente novamente.' }

    setPlayer(created)
    localStorage.setItem('bolao_player', JSON.stringify(created))
    return {}
  }

  function logout() {
    setPlayer(null)
    localStorage.removeItem('bolao_player')
  }

  const isAdmin =
    player?.is_admin === true ||
    player?.nickname?.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_NICKNAME ?? '').toLowerCase()

  return (
    <Ctx.Provider value={{ player, loading, login, logout, isAdmin }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
