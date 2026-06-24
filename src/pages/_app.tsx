import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { AuthProvider, useAuth } from '@/lib/auth'
import { subscribeToPush } from '@/lib/push'
import SplashScreen from '@/components/SplashScreen'
import '@/styles/globals.css'

// ── Conteúdo do app, dentro do AuthProvider ───────────────────────────
// Precisa estar AQUI dentro (e não no componente App, abaixo) porque só
// assim o useAuth() consegue ler o player — fora do Provider ele não
// existe ainda. É por isso que o convite pra ativar notificações (que
// precisa do player.id) mora neste componente, junto com o popup de
// atualização.
function AppContent({ Component, pageProps, showSplash, onSplashDone }: {
  Component: AppProps['Component']; pageProps: AppProps['pageProps']
  showSplash: boolean; onSplashDone: () => void
}) {
  const router = useRouter()
  const { player } = useAuth()

  // ── Atualização do app ──────────────────────────────────────────
  // Esta lógica mora aqui (em _app.tsx) e não em Layout.tsx de propósito:
  // _app.tsx só monta UMA VEZ por sessão de navegação. Layout.tsx é
  // importado individualmente em cada página (picks, champion, ranking,
  // watch), então toda troca de aba desmontava e remontava o Layout —
  // e com ele, o efeito de checagem de versão disparava de novo a cada
  // clique, fazendo o popup de "nova versão" aparecer/desaparecer em
  // sequência rápida (o "piscando" relatado). Aqui ele roda uma vez ao
  // abrir o app, a cada 3 minutos, E também a cada troca de aba — mas
  // como o componente nunca remonta, o estado nunca se perde no meio
  // do caminho, então o popup fica fixo até o usuário decidir.
  const [hasUpdate,  setHasUpdate]  = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [notifyEnabled, setNotifyEnabled] = useState(true) // true até checarmos, pra não "flashar" o convite
  const latestVersionRef = useRef<string>('')

  // Estado da permissão de notificação — checado uma vez, atualizado quando
  // o jogador ativa pelo botão dentro do próprio popup.
  useEffect(() => {
    if (typeof Notification === 'undefined') { setNotifyEnabled(true); return }
    setNotifyEnabled(Notification.permission === 'granted')
  }, [])

  const checkVersion = useRef(async () => {
    try {
      const res = await fetch('/api/version?t=' + Date.now())
      if (!res.ok) return
      const { version } = await res.json()
      latestVersionRef.current = version
      const stored = sessionStorage.getItem('app_version')
      if (!stored) {
        // Primeira checagem desta sessão — só guarda, não mostra popup
        sessionStorage.setItem('app_version', version)
        return
      }
      if (stored !== version) {
        sessionStorage.setItem('app_update_pending', '1')
        setHasUpdate(true)
      }
    } catch {}
  })

  // Roda 1x ao abrir o app + a cada 3 minutos
  useEffect(() => {
    let cancelled = false
    const run = () => { if (!cancelled) checkVersion.current() }
    run()
    const interval = setInterval(run, 3 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Roda também a cada troca de aba — sem risco de "piscar", porque este
  // componente não desmonta entre navegações (diferente do Layout antigo).
  useEffect(() => {
    const onRouteChange = () => { checkVersion.current() }
    router.events.on('routeChangeComplete', onRouteChange)
    return () => router.events.off('routeChangeComplete', onRouteChange)
  }, [router.events])

  async function handleUpdateNow() {
    setHasUpdate(false)
    setIsUpdating(true)
    document.body.style.overflow = 'hidden'
    sessionStorage.removeItem('app_version')
    sessionStorage.removeItem('app_update_pending')
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      await new Promise(r => setTimeout(r, 400))
    } catch {}
    window.location.replace(window.location.origin + window.location.pathname + '?v=' + Date.now())
  }

  function handleUpdateLater() {
    if (latestVersionRef.current) sessionStorage.setItem('app_version', latestVersionRef.current)
    sessionStorage.removeItem('app_update_pending')
    setHasUpdate(false)
  }

  async function handleActivateBell() {
    if (!player) return
    const ok = await subscribeToPush(player.id)
    if (ok) setNotifyEnabled(true)
  }

  return (
    <>
      <Head>
        <meta name="application-name" content="Bolão Copa 2026 BEL"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
        <meta name="apple-mobile-web-app-title" content="Bolão BEL"/>
        <meta name="format-detection" content="telephone=no"/>
        <meta name="mobile-web-app-capable" content="yes"/>
        <meta name="theme-color" content="#0099CC"/>
        <link rel="manifest" href="/manifest.json"/>
        <link rel="apple-touch-icon" href="/icon-192.png"/>
        <link rel="icon" type="image/x-icon" href="/favicon.ico"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
      </Head>

      {/* Splash only on first open per session */}
      {showSplash && <SplashScreen onDone={onSplashDone}/>}

      {/* ── Painel de nova versão — central, fixo, não pisca mais ao navegar.
          Quando o jogador ainda não ativou notificações, aproveita o mesmo
          popup pra convidar a ativar o sino (em vez de um banner separado). */}
      {hasUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,20,40,0.7)' }}>
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-xl">
            <div className="px-6 pt-6 pb-5 text-center">
              <div className="w-14 h-14 rounded-full bg-[#0099CC]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </div>
              <p className="text-[16px] font-bold text-gray-900 mb-1.5">Nova versão disponível!</p>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Atualize para continuar usando o bolão corretamente, com todas as últimas melhorias e correções.
              </p>
            </div>
            <div className="px-6 pb-6">
              <button onClick={handleUpdateNow}
                className="w-full bg-[#0099CC] text-white font-bold text-[14px] py-3 rounded-xl hover:bg-[#007aa8] transition-colors mb-2 active:scale-[.98]">
                Atualizar agora
              </button>
              <button onClick={handleUpdateLater}
                className="w-full text-gray-400 text-[13px] py-2 hover:text-gray-500 transition-colors">
                Mais tarde
              </button>
            </div>

            {player && !notifyEnabled && (
              <div className="px-5 pb-5 -mt-1">
                <button onClick={handleActivateBell}
                  className="w-full flex items-center gap-3 bg-[#EFF8FC] border border-[#0099CC]/20 rounded-xl px-3 py-3 text-left hover:bg-[#E6F1FB] transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[#0099CC]/15 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-900 leading-tight">Já aproveite e ative o sino 🔔</p>
                    <p className="text-[10.5px] text-gray-500 leading-snug mt-0.5">Receba avisos de gol, do seu palpite e de próximas atualizações.</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay de "atualizando" durante o reload limpo */}
      {isUpdating && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4"
          style={{transform:'translateZ(0)'}}>
          <span className="w-10 h-10 border-3 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" style={{borderWidth:3}}/>
          <p className="text-[14px] font-semibold text-gray-700">Atualizando...</p>
          <p className="text-[11px] text-gray-400">Aguarde um momento</p>
        </div>
      )}

      <div style={{ opacity: showSplash ? 0 : 1, transition: 'opacity 0.4s ease' }}>
        <Component {...pageProps}/>
      </div>
    </>
  )
}

export default function App({ Component, pageProps }: AppProps) {
  const [showSplash, setShowSplash] = useState(true)
  const [mounted,    setMounted]    = useState(false)

  useEffect(() => {
    setMounted(true)
    const shown = sessionStorage.getItem('splash_shown')
    if (shown) setShowSplash(false)

    // Register service worker for push + offline
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  function handleSplashDone() {
    sessionStorage.setItem('splash_shown', '1')
    setShowSplash(false)
  }

  if (!mounted) return null

  return (
    <AuthProvider>
      <AppContent Component={Component} pageProps={pageProps} showSplash={showSplash} onSplashDone={handleSplashDone}/>
    </AuthProvider>
  )
}
