'use client'
import { useState, FormEvent } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/router'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(nickname)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    router.push('/champion')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E1F5EE] to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#1D9E75] mb-4 shadow-lg">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Bolão Copa 2026</h1>
          <p className="text-gray-500 text-sm mt-1">EUA · México · Canadá</p>
        </div>

        {/* Form */}
        <div className="card p-6 shadow-md">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Entrar no bolão</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Seu apelido</label>
              <input
                className="input text-base"
                placeholder="Ex: Zé Craque"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                maxLength={30}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Se já participou, use o mesmo apelido para entrar.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !nickname.trim()}
              className="btn btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : '⚽ Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Bolão exclusivo para o time 🤝
        </p>
      </div>
    </div>
  )
}
