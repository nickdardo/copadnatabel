import { useState, FormEvent, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/router'
import Head from 'next/head'
import TutorialModal from '@/components/TutorialModal'

// SVG Icons inline (no emoji)
const IcoUser = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IcoLock = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IcoInfo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const IcoArrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
const IcoX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{background:'rgba(0,20,40,0.75)'}}>
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[82vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-900 text-[16px]">Como funciona</h2>
            <p className="text-[11px] text-gray-400">Bolão Copa 2026 BEL</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
            <IcoX />
          </button>
        </div>
        <div className="px-5 py-4 space-y-5">
          <div className="bg-[#E6F4FA] rounded-xl p-4">
            <p className="text-[13px] font-semibold text-[#0099CC] mb-1">Objetivo</p>
            <p className="text-[13px] text-gray-600 leading-relaxed">Acerte os placares dos 104 jogos da Copa 2026 e acumule pontos. Quem tiver mais pontos ao final vence o Bolão BEL!</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Pontuação por jogo</p>
            <div className="space-y-2">
              {[
                {pts:'10 pts',bg:'bg-green-100 text-green-800',label:'Placar exato',desc:'Ex: chutou 2×1, deu 2×1'},
                {pts:'7 pts', bg:'bg-blue-100 text-blue-800', label:'Resultado + 1 placar certo',desc:'Ex: chutou 2×1, deu 3×1'},
                {pts:'5 pts', bg:'bg-amber-100 text-amber-800',label:'Resultado certo',desc:'Acertou vitória/empate/derrota'},
                {pts:'2 pts', bg:'bg-pink-100 text-pink-800', label:'1 placar parcial certo',desc:'Ex: chutou 2×1, deu 2×3'},
                {pts:'0 pts', bg:'bg-gray-100 text-gray-500', label:'Nenhum acerto',desc:''},
              ].map(r => (
                <div key={r.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg whitespace-nowrap ${r.bg}`}>{r.pts}</span>
                  <div><p className="text-[13px] font-semibold text-gray-800">{r.label}</p>{r.desc&&<p className="text-[11px] text-gray-400">{r.desc}</p>}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Bônus · Palpite de campeão</p>
            <div className="space-y-2">
              {[{l:'Campeão',p:'+50 pts'},{l:'Vice',p:'+25 pts'},{l:'3º lugar',p:'+10 pts'}].map(b=>(
                <div key={b.l} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-[13px] font-medium text-gray-700">{b.l}</span>
                  <span className="text-[13px] font-bold text-gray-900">{b.p}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[12px] font-bold text-amber-800 mb-1">Inscrição · R$ 10,00</p>
            <p className="text-[12px] text-amber-700 leading-relaxed">Pague ao gerente <strong>Aristone Figueredo</strong>. O prêmio final só é liberado após a confirmação do pagamento.</p>
          </div>
          <div className="bg-[#E6F4FA] border border-[#0099CC]/20 rounded-xl p-4">
            <p className="text-[12px] font-bold text-[#0099CC] mb-1">Limite de alterações</p>
            <p className="text-[12px] text-gray-600 leading-relaxed">Após salvar seus palpites, você pode alterá-los até <strong>3 vezes por rodada</strong>. Use com sabedoria!</p>
          </div>
          <button onClick={onClose} className="w-full py-3.5 rounded-xl bg-[#0099CC] text-white font-semibold text-[14px] hover:bg-[#007aa8] transition-colors">
            Entendido!
          </button>
        </div>
      </div>
    </div>
  )
}

type Mode = 'login'|'register'

export default function LoginPage() {
  const { login, register } = useAuth()
  const router = useRouter()
  const [mode,       setMode]       = useState<Mode>('login')
  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPass,   setShowPass]   = useState(false)
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [showRules,  setShowRules]  = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const tutorialDelay = useRef<ReturnType<typeof setTimeout> | null>(null)

  function switchMode(m: Mode) { setMode(m); setError(''); setUsername(''); setPassword(''); setConfirm('') }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError('')
    if (mode==='register' && password!==confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    const result = mode==='login' ? await login(username,password) : await register(username,password)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    if (rememberMe) localStorage.setItem('bolao_remember','1')
    router.push(mode==='register' ? '/profile-setup' : '/champion')
  }

  return (
    <>
      <Head>
        <title>Bolão Copa 2026 BEL</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#002240" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      <div className="relative min-h-screen flex flex-col items-center justify-center p-5 overflow-hidden bg-[#002240]">
        <div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage:"url('/copa2026-bg.webp')",opacity:0.22}} />
        <div className="absolute inset-0" style={{background:'linear-gradient(180deg,rgba(0,25,50,.65) 0%,rgba(0,34,64,.82) 55%,rgba(0,15,35,.96) 100%)'}} />

        <div className="relative z-10 w-full max-w-sm">
          <div className="relative bg-white rounded-[22px] px-8 py-8 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1" style={{background:'linear-gradient(90deg,#0099CC 65%,#8DC63F 100%)'}} />

            {/* Logo — transparent, no black background */}
            <div className="flex justify-center mb-2 mt-1">
              <img src="/copa2026-logo.jpg" alt="Copa 2026" className="h-16 w-auto rounded-xl object-contain" />
            </div>

            {/* Title */}
            <p className="text-center text-[11px] text-gray-400 font-semibold tracking-[.12em] uppercase mb-5">
              Bolão · Copa do Mundo 2026
            </p>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
              {(['login','register'] as Mode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all
                    ${mode===m ? 'bg-white text-[#0099CC] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  {m==='login' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3" autoComplete="on">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Usuário</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300"><IcoUser /></span>
                  <input name="username" autoComplete="username"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                    placeholder="seu.usuario" value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g,''))}
                    autoCapitalize="none" autoFocus />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Senha</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300"><IcoLock /></span>
                  <input name="password" autoComplete={mode==='login'?'current-password':'new-password'}
                    type={showPass?'text':'password'}
                    className="w-full pl-9 pr-14 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                    placeholder={mode==='register'?'Mínimo 6 caracteres':'••••••'}
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={()=>setShowPass(s=>!s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#0099CC] hover:text-[#007aa8]">
                    {showPass?'Ocultar':'Ver'}
                  </button>
                </div>
              </div>
              {mode==='register' && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Confirmar senha</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300"><IcoLock /></span>
                    <input name="confirm-password" autoComplete="new-password" type={showPass?'text':'password'}
                      className="w-full pl-9 pr-8 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0099CC]/20 focus:border-[#0099CC] transition-all placeholder:text-gray-300"
                      placeholder="Repita a senha" value={confirm} onChange={e => setConfirm(e.target.value)} />
                    {confirm && <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-bold ${confirm===password?'text-green-500':'text-red-400'}`}>{confirm===password?'✓':'✗'}</span>}
                  </div>
                </div>
              )}

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                <div onClick={()=>setRememberMe(r=>!r)}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${rememberMe?'bg-[#0099CC]':'bg-gray-200'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${rememberMe?'translate-x-4':'translate-x-0'}`} />
                </div>
                <span className="text-[13px] text-gray-500 font-medium">Permanecer conectado</span>
              </label>

              {error && <div className="bg-red-50 border border-red-100 text-red-500 text-[12px] rounded-xl px-4 py-2.5">{error}</div>}

              <button type="submit" disabled={loading||!username||!password}
                className="w-full py-3.5 rounded-xl font-semibold text-[15px] text-white flex items-center justify-center gap-2 transition-all active:scale-[.98] bg-[#0099CC] hover:bg-[#007aa8] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <>{mode==='login'?'Entrar':'Criar conta'} <IcoArrow /></>}
              </button>
            </form>

            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowRules(true)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:text-[#0099CC] transition-all flex items-center justify-center gap-2">
                <IcoInfo /> Regras
              </button>
              <button onClick={() => setShowTutorial(true)}
                className="flex-1 py-2.5 rounded-xl border border-[#0099CC]/20 bg-[#E6F4FA] text-[13px] font-semibold text-[#0099CC] hover:bg-[#d0ebf7] transition-all flex items-center justify-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Ver tutorial
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1" style={{background:'linear-gradient(90deg,#0099CC 65%,#8DC63F 100%)'}} />
          </div>
        </div>
        <p className="relative z-10 text-center text-[11px] text-white/30 mt-5 tracking-wide">
          Copa do Mundo FIFA 2026 · 104 jogos · 48 seleções
        </p>
      </div>
    </>
  )
}
