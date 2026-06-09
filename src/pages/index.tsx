import { useState, FormEvent } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { IconUser, IconLock, IconArrowRight, IconCheck } from '@/components/Icons'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const { login, register } = useAuth()
  const router = useRouter()

  const [mode,     setMode]     = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  function switchMode(m: Mode) {
    setMode(m); setError('')
    setUsername(''); setPassword(''); setConfirm('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (mode === 'register' && password !== confirm) {
      setError('As senhas não coincidem.'); return
    }

    setLoading(true)
    const result = mode === 'login'
      ? await login(username, password)
      : await register(username, password)
    setLoading(false)

    if (result.error) { setError(result.error); return }

    // After register → go to profile setup
    // After login → go to champion picks
    router.push(mode === 'register' ? '/profile-setup' : '/champion')
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
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/copa2026-bg.webp')", opacity: 0.25 }} />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg,rgba(0,30,55,.6) 0%,rgba(0,40,70,.75) 50%,rgba(0,20,40,.92) 100%)' }} />

        <div className="relative z-10 w-full max-w-sm">
          <div className="relative bg-white rounded-[22px] px-8 py-9 shadow-2xl overflow-hidden">

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg,#0099CC 65%,#8DC63F 100%)' }} />

            {/* Logo */}
            <div className="flex justify-center mb-5 mt-1">
              <img src="/dnata-logo.png" alt="dnata" className="h-9 w-auto object-contain" />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-400 font-semibold tracking-[.1em] uppercase whitespace-nowrap">
                Bolão Copa do Mundo 2026
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Mode tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              {(['login', 'register'] as Mode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all
                    ${mode === m ? 'bg-white text-[#0099CC] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Username */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Usuário
                </label>
                <div className="relative">
                  <IconUser size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50
                               text-gray-900 text-[14px] focus:outline-none focus:ring-2
                               focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                    placeholder="seu.usuario"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g,''))}
                    autoCapitalize="none"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <IconLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="w-full pl-9 pr-10 py-3 rounded-xl border border-gray-200 bg-gray-50
                               text-gray-900 text-[14px] focus:outline-none focus:ring-2
                               focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                    placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-[11px] font-medium">
                    {showPass ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              {/* Confirm password (register only) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <IconLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50
                                 text-gray-900 text-[14px] focus:outline-none focus:ring-2
                                 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                      placeholder="Repita a senha"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                    {confirm && password && (
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${confirm === password ? 'text-green-500' : 'text-red-400'}`}>
                        {confirm === password ? <IconCheck size={15} /> : '✕'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-[12px] rounded-xl px-4 py-2.5">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || !username || !password}
                className="w-full py-3.5 rounded-xl font-semibold text-[15px] text-white mt-1
                           flex items-center justify-center gap-2 transition-all active:scale-[.98]
                           bg-[#0099CC] hover:bg-[#007aa8] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : mode === 'login'
                    ? <>Entrar <IconArrowRight size={16} /></>
                    : <>Criar conta <IconArrowRight size={16} /></>}
              </button>
            </form>

            <div className="absolute bottom-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg,#0099CC 65%,#8DC63F 100%)' }} />
          </div>

          <p className="text-center text-[11px] text-white/30 mt-5 tracking-wide">
            Copa do Mundo FIFA 2026 &nbsp;·&nbsp; 104 jogos &nbsp;·&nbsp; 48 seleções
          </p>
        </div>
      </div>
    </>
  )
}
