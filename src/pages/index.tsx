import { useState, FormEvent } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const parts = name.trim().split(/\s+/)
    if (parts.length < 2) {
      setError('Por favor, informe seu primeiro e último nome.')
      return
    }
    setLoading(true)
    const result = await login(name.trim())
    setLoading(false)
    if (result.error) { setError(result.error); return }
    router.push('/champion')
  }

  return (
    <>
      <Head>
        <title>Bolão Copa 2026 · dnata</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#003a5c" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>

      <div className="relative min-h-screen flex items-center justify-center p-5 overflow-hidden bg-[#003a5c]">

        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/copa2026-bg.webp')", opacity: 0.25 }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg,rgba(0,30,55,0.6) 0%,rgba(0,40,70,0.75) 50%,rgba(0,20,40,0.92) 100%)' }}
        />

        {/* Card */}
        <div className="relative z-10 w-full max-w-sm">
          <div className="relative bg-white rounded-[22px] px-8 py-9 shadow-2xl overflow-hidden">

            {/* Top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg,#0099CC 65%,#8DC63F 100%)' }} />

            {/* dnata logo */}
            <div className="flex justify-center mb-6 mt-2">
              <img
                src="/dnata-logo.png"
                alt="dnata"
                className="h-9 w-auto object-contain"
              />
            </div>

            {/* Divider with text */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-400 font-semibold tracking-[0.12em] uppercase whitespace-nowrap">
                Bolão Copa do Mundo 2026
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Country badges */}
            <div className="flex justify-center gap-2 mb-6">
              {[['🇺🇸','EUA'],['🇲🇽','México'],['🇨🇦','Canadá']].map(([flag, country]) => (
                <div key={country} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-full px-3 py-1">
                  <span className="text-sm">{flag}</span>
                  <span className="text-[11px] text-gray-500 font-medium">{country}</span>
                </div>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-[#001e3c] text-center leading-snug mb-1">
              Bem-vindo ao Bolão!
            </h1>
            <p className="text-[13px] text-gray-400 text-center mb-7 leading-relaxed">
              Registre-se e faça seus palpites
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Seu primeiro e último nome
                </label>
                <input
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200
                             bg-gray-50 text-gray-900 text-[15px]
                             focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC]
                             transition-all placeholder:text-gray-300"
                  placeholder="Ex: João Silva"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={50}
                  autoFocus
                  autoComplete="name"
                />
                <p className="text-[11px] text-gray-300 mt-1.5 ml-1">
                  Já participou? Use o mesmo nome para entrar.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-[12px] rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-3.5 rounded-xl font-semibold text-[15px] text-white
                           transition-all active:scale-[.98]
                           disabled:opacity-40 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
                style={{ background: loading || !name.trim() ? '#0099CC' : '#0099CC' }}
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Entrar no Bolão'}
              </button>
            </form>

            {/* Bottom accent bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg,#0099CC 65%,#8DC63F 100%)' }} />
          </div>

          <p className="text-center text-[11px] text-white/30 mt-5 tracking-wide">
            Copa do Mundo FIFA 2026 &nbsp;&middot;&nbsp; 104 jogos &nbsp;&middot;&nbsp; 48 seleções
          </p>
        </div>
      </div>
    </>
  )
}
