import { useState, FormEvent } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { IconUser, IconLock, IconArrowRight } from '@/components/Icons'

type Mode = 'login' | 'register'

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,20,40,0.7)' }}>
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-[16px]">Como funciona o Bolão</h2>
            <p className="text-[11px] text-gray-400">Copa do Mundo 2026</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* Objective */}
          <div className="bg-[#E6F4FA] rounded-xl p-4">
            <p className="text-[13px] font-semibold text-[#0099CC] mb-1">O objetivo</p>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              Acerte os placares dos jogos da Copa 2026 e acumule pontos. Quem terminar o torneio com mais pontos vence o bolão!
            </p>
          </div>

          {/* Scoring */}
          <div>
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide mb-3">Sistema de pontuação</p>
            <div className="space-y-2">
              {[
                { label: 'Placar exato',              pts: '10 pts', color: 'bg-green-100 text-green-800',  desc: 'Ex: chutou 2×1, deu 2×1' },
                { label: 'Resultado + 1 placar certo', pts: '7 pts',  color: 'bg-blue-100 text-blue-800',   desc: 'Ex: chutou 2×1, deu 3×1' },
                { label: 'Resultado certo',            pts: '5 pts',  color: 'bg-amber-100 text-amber-800', desc: 'Acertou vitória/empate/derrota' },
                { label: '1 placar certo',             pts: '2 pts',  color: 'bg-pink-100 text-pink-800',   desc: 'Ex: chutou 2×1, deu 2×3' },
                { label: 'Nenhum acerto',              pts: '0 pts',  color: 'bg-gray-100 text-gray-500',   desc: 'Não acertou nada' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg whitespace-nowrap ${r.color}`}>{r.pts}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">{r.label}</p>
                    <p className="text-[11px] text-gray-400">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Champion bonus */}
          <div>
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide mb-3">Bônus — Palpite de campeão</p>
            <div className="space-y-2">
              {[
                { label: 'Acertar o campeão',    pts: '+50 pts', bg: 'bg-amber-50 border-amber-200' },
                { label: 'Acertar o vice',        pts: '+25 pts', bg: 'bg-gray-50 border-gray-200' },
                { label: 'Acertar o 3º lugar',    pts: '+10 pts', bg: 'bg-orange-50 border-orange-200' },
              ].map(b => (
                <div key={b.label} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${b.bg}`}>
                  <span className="text-[13px] font-medium text-gray-700">{b.label}</span>
                  <span className="text-[13px] font-bold text-gray-800">{b.pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tiebreak */}
          <div>
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide mb-3">Desempate</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
              {['Mais placares exatos (10pts)','Mais resultados + placar (7pts)','Mais resultados certos (5pts)','Mais placares parciais (2pts)','Menos erros (0pts)','Data de entrada no bolão'].map((t,i) => (
                <div key={i} className="flex items-center gap-2.5 text-[12px] text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-[#0099CC]/10 text-[#0099CC] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[12px] font-bold text-amber-800 mb-1.5">Sobre o pagamento</p>
            <p className="text-[12px] text-amber-700 leading-relaxed">
              A inscrição custa <strong>R$ 10,00</strong>. O pagamento deve ser feito ao gerente <strong>Aristone Figueredo</strong>. Caso ganhe o bolão ao final da Copa, o prêmio só será liberado após a confirmação do seu pagamento.
            </p>
          </div>

          <button onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-[#0099CC] text-white font-semibold text-[14px] hover:bg-[#007aa8] transition-colors">
            Entendido!
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { login, register } = useAuth()
  const router = useRouter()

  const [mode,      setMode]      = useState<Mode>('login')
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [showPass,  setShowPass]  = useState(false)
  const [showRules, setShowRules] = useState(false)

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

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      <div className="relative min-h-screen flex flex-col items-center justify-center p-5 overflow-hidden bg-[#002240]">
        {/* BG */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage:"url('/copa2026-bg.webp')", opacity:0.22 }} />
        <div className="absolute inset-0" style={{ background:'linear-gradient(180deg,rgba(0,25,50,.65) 0%,rgba(0,34,64,.8) 50%,rgba(0,15,35,.95) 100%)' }} />

        {/* Flags strip */}
        <div className="relative z-10 flex gap-2 mb-5 flex-wrap justify-center">
          {['🇧🇷','🇦🇷','🇫🇷','🇩🇪','🇪🇸','🇵🇹','🇺🇸','🇲🇽','🇨🇦','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇳🇱','🇯🇵'].map(f => (
            <span key={f} className="text-xl opacity-70">{f}</span>
          ))}
        </div>

        <div className="relative z-10 w-full max-w-sm">
          <div className="relative bg-white rounded-[24px] px-8 py-8 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background:'linear-gradient(90deg,#0099CC 65%,#8DC63F 100%)' }} />

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
            <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
              {(['login','register'] as Mode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all
                    ${mode === m ? 'bg-white text-[#0099CC] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3" autoComplete="on">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Usuário</label>
                <div className="relative">
                  <IconUser size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="username" autoComplete="username"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                    placeholder="seu.usuario"
                    value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g,''))}
                    autoCapitalize="none" autoFocus />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Senha</label>
                <div className="relative">
                  <IconLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    type={showPass ? 'text' : 'password'}
                    className="w-full pl-9 pr-14 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                    placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••'}
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#0099CC] hover:text-[#007aa8]">
                    {showPass ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Confirmar senha</label>
                  <div className="relative">
                    <IconLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input name="confirm-password" autoComplete="new-password"
                      type={showPass ? 'text' : 'password'}
                      className="w-full pl-9 pr-8 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                      placeholder="Repita a senha"
                      value={confirm} onChange={e => setConfirm(e.target.value)} />
                    {confirm && (
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-bold ${confirm === password ? 'text-green-500' : 'text-red-400'}`}>
                        {confirm === password ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-[12px] rounded-xl px-4 py-2.5">{error}</div>
              )}

              <button type="submit" disabled={loading || !username || !password}
                className="w-full py-3.5 rounded-xl font-semibold text-[15px] text-white mt-1 flex items-center justify-center gap-2 transition-all active:scale-[.98] bg-[#0099CC] hover:bg-[#007aa8] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : mode === 'login' ? <>Entrar <IconArrowRight size={16} /></> : <>Criar conta <IconArrowRight size={16} /></>}
              </button>
            </form>

            {/* Rules button */}
            <button onClick={() => setShowRules(true)}
              className="w-full mt-3 py-2.5 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:text-[#0099CC] transition-all flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Como funciona o bolão
            </button>

            <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background:'linear-gradient(90deg,#0099CC 65%,#8DC63F 100%)' }} />
          </div>
        </div>

        <p className="relative z-10 text-center text-[11px] text-white/30 mt-5 tracking-wide">
          Copa do Mundo FIFA 2026 &nbsp;·&nbsp; 104 jogos &nbsp;·&nbsp; 48 seleções
        </p>
      </div>
    </>
  )
}
