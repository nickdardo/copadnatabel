import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Head from 'next/head'
import { useEffect, useState, useRef } from 'react'
import { IconTrophy, IconBall, IconBarChart, IconSettings, IconLogout, IconInfo } from '@/components/Icons'
import TutorialModal from '@/components/TutorialModal'

// Bottom nav items (sem o botão central Assistir que é renderizado separado)
const NAV_LEFT  = [
  { href: '/champion', Icon: IconTrophy,   label: 'Campeão'  },
  { href: '/picks',    Icon: IconBall,     label: 'Palpites' },
]
const NAV_RIGHT = [
  { href: '/ranking',    Icon: IconBarChart, label: 'Ranking' },
  { href: '/onboarding', Icon: IconInfo,     label: 'Regras'  },
]

// iOS install instructions modal
function IosInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ background: 'rgba(0,20,40,0.7)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Arrow pointing to bottom bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-5 pt-2 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-[16px]">Instalar no iPhone</h2>
              <p className="text-[11px] text-gray-400">Adicionar à Tela de Início</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                step: '1',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                ),
                text: 'Toque no ícone de compartilhar na barra inferior do Safari',
              },
              {
                step: '2',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                ),
                text: 'Role para baixo e toque em "Adicionar à Tela de Início"',
              },
              {
                step: '3',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ),
                text: 'Toque em "Adicionar" no canto superior direito',
              },
            ].map(({ step, icon, text }) => (
              <div key={step} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-7 h-7 rounded-full bg-[#E6F4FA] flex items-center justify-center flex-shrink-0">
                  {icon}
                </div>
                <div className="flex-1">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Passo {step}</span>
                  <p className="text-[13px] text-gray-700 leading-snug mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-[#E6F4FA] border border-[#0099CC]/20 rounded-xl p-3 text-center">
            <p className="text-[12px] text-[#0099CC] font-medium">
              Abra o site no <strong>Safari</strong> para instalar o app 🏆
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

type Props = { children?: React.ReactNode; title: string; step?: number }

// ── Modal de permissão de notificação ──────────────────────────
function NotifyPermissionModal({ onAllow, onDismiss }: { onAllow: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,20,40,0.7)' }}
      onClick={onDismiss}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-4 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200"/>
        </div>
        <div className="px-5 pt-3 pb-6">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#E6F4FA] border border-[#0099CC]/20 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="1.75" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <h2 className="text-[17px] font-bold text-gray-900 text-center mb-2">
            Ativar notificações
          </h2>
          <p className="text-[13px] text-gray-500 text-center leading-relaxed mb-5">
            Receba avisos de jogos que estão prestes a começar, resultados e atualizações do ranking — mesmo com o app fechado.
          </p>
          {/* Benefits */}
          <div className="space-y-2.5 mb-5">
            {[
              { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Aviso 6h antes de cada jogo para fazer seu palpite' },
              { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Resultado assim que o jogo terminar' },
              { icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', text: 'Aviso quando o ranking for atualizado' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#E6F4FA] flex items-center justify-center flex-shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="2" strokeLinecap="round">
                    <path d={item.icon}/>
                  </svg>
                </div>
                <p className="text-[12px] text-gray-600 leading-snug">{item.text}</p>
              </div>
            ))}
          </div>
          {/* Buttons */}
          <button onClick={onAllow}
            className="w-full py-3.5 rounded-2xl bg-[#0099CC] text-white font-bold text-[15px] hover:bg-[#007aa8] transition-all active:scale-[.98] mb-2">
            Ativar notificações
          </button>
          <button onClick={onDismiss}
            className="w-full py-2.5 rounded-2xl text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout({ children, title }: Props) {
  const router    = useRouter()
  const { player, logout, isAdmin, refreshPlayer } = useAuth()
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIosModal, setShowIosModal] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [groupLink, setGroupLink] = useState<string | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [showNotifyLog, setShowNotifyLog] = useState(false)
  const [notifyLog, setNotifyLog] = useState<{title:string;body:string;time:number}[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [notifyBannerHidden, setNotifyBannerHidden] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const [hasUpdate,    setHasUpdate]    = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem('app_update_pending') === '1'
  )
  const [isUpdating,   setIsUpdating]   = useState(false)
  const [hasLive,      setHasLive]      = useState(false)
  const [watchAtivo,   setWatchAtivo]   = useState(false)

  async function fetchNotifyLog() {
    if (!player) return
    setLoadingLog(true)
    try {
      const res = await fetch(`/api/push/log?player_id=${player.id}`)
      const { data } = await res.json()
      setNotifyLog((data || []).map((n: { title: string; body: string; sent_at: string }) => ({
        title: n.title, body: n.body, time: new Date(n.sent_at).getTime(),
      })))
    } catch {}
    setLoadingLog(false)
  }
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  // Check current notification permission state + load log
  useEffect(() => {
    if (!player || !('Notification' in window)) return

    const hasNotifAPI = typeof Notification !== 'undefined'
    const enabled = hasNotifAPI && Notification.permission === 'granted'
    setNotifyEnabled(enabled)

    // Check if banner was dismissed this session
    if (sessionStorage.getItem('notify_banner_hidden') === '1') {
      setNotifyBannerHidden(true)
    }

    // Listen for banner hide event from dismiss button
    function onHide() { setNotifyBannerHidden(true) }
    window.addEventListener('notify_banner_hide', onHide)

    // Already granted or permanently denied — nothing to do for prompt
    if (!hasNotifAPI || Notification.permission !== 'default') {
      return () => window.removeEventListener('notify_banner_hide', onHide)
    }

    // Check dismissal history
    const dismissed   = parseInt(localStorage.getItem('notify_dismissed_count') || '0')
    const lastDismiss = parseInt(localStorage.getItem('notify_dismissed_at')    || '0')
    const hoursSince  = (Date.now() - lastDismiss) / 3_600_000

    if (!hasNotifAPI || dismissed >= 3) return () => window.removeEventListener('notify_banner_hide', onHide)
    const delay = dismissed === 0 ? 2500 : hoursSince >= 24 ? 2500 : null
    if (delay === null) return () => window.removeEventListener('notify_banner_hide', onHide)

    const t = setTimeout(() => setShowNotifyModal(true), delay)
    return () => {
      clearTimeout(t)
      window.removeEventListener('notify_banner_hide', onHide)
    }
  }, [player?.id])



  // Refresh player on route change
  useEffect(() => {
    refreshPlayer()
    supabase.from('matches').select('id', { count: 'exact', head: true })
      .eq('status', 'live')
      .then(({ count }) => setHasLive((count ?? 0) > 0))
    supabase.from('pix_config').select('watch_ativo').limit(1)
      .then(({ data }) => setWatchAtivo(data?.[0]?.watch_ativo || false))
  }, [router.pathname])

  // Load group link once
  useEffect(() => {
    supabase.from('pix_config').select('group_link').limit(1).then(({ data }) => {
      if (data?.[0]?.group_link) setGroupLink(data[0].group_link)
    })
  }, [])

  // Version checker — polls every 3 minutes
  const latestVersionRef = useRef<string>('')
  useEffect(() => {
    // Store current version on first load
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version?t=' + Date.now())
        if (!res.ok) return
        const { version } = await res.json()
        latestVersionRef.current = version
        const stored = sessionStorage.getItem('app_version')
        if (!stored) {
          // First check — just save, don't show banner
          sessionStorage.setItem('app_version', version)
          return
        }
        if (stored !== version) {
          sessionStorage.setItem('app_update_pending', '1')
          setHasUpdate(true)
        }
      } catch {}
    }
    checkVersion()
    const interval = setInterval(checkVersion, 3 * 60 * 1000) // every 3 min
    return () => clearInterval(interval)
  }, [])

  // PWA install detection
  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    // Check if dismissed
    const dismissed = sessionStorage.getItem('pwa_banner_dismissed')
    if (dismissed) return

    // Check iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIos(ios)

    if (ios) {
      setShowInstallBanner(true)
      return
    }

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  async function handleInstallClick() {
    if (isIos) {
      setShowIosModal(true)
      return
    }
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt()
      const { outcome } = await deferredPrompt.current.userChoice
      if (outcome === 'accepted') {
        setShowInstallBanner(false)
        deferredPrompt.current = null
      }
    }
  }

  function dismissBanner() {
    setShowInstallBanner(false)
    sessionStorage.setItem('pwa_banner_dismissed', '1')
  }

  // Resolve avatar URL
  useEffect(() => {
    if (!player?.avatar_url) { setAvatarSrc(null); return }
    if (player.avatar_url.startsWith('http')) {
      setAvatarSrc(player.avatar_url + '?v=' + Date.now()); return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(player.avatar_url)
    setAvatarSrc(data.publicUrl + '?v=' + Date.now())
  }, [player?.avatar_url])

  async function subscribeToPush(): Promise<boolean> {
    if (!player || !('Notification' in window) || !('serviceWorker' in navigator)) return false
    if (typeof Notification === 'undefined') return false
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return false
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return false
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: player.id, subscription: sub }),
      })
      setNotifyEnabled(true)
      localStorage.removeItem('notify_dismissed_count')
      localStorage.removeItem('notify_dismissed_at')
      return true
    } catch { return false }
  }

  function handleLogout() { logout(); router.push('/') }

  const initials = player?.nickname
    ? player.nickname.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : player?.username?.slice(0, 2).toUpperCase() || '?'

  const displayName = (player?.nickname && player.nickname !== player?.username)
    ? player.nickname
    : player?.username || ''

  return (
    <>
      <Head>
        <title>{title} · Bolão Copa 2026 BEL</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <meta name="theme-color" content="#0099CC"/>
        <link rel="icon" type="image/x-icon" href="/favicon.ico"/>
        <link rel="manifest" href="/manifest.json"/>
      </Head>

      {showIosModal && <IosInstallModal onClose={() => setShowIosModal(false)} />}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showNotifyModal && (
        <NotifyPermissionModal
          onAllow={async () => {
            setShowNotifyModal(false)
            await subscribeToPush()
          }}
          onDismiss={() => {
            setShowNotifyModal(false)
            const count = parseInt(localStorage.getItem('notify_dismissed_count') || '0')
            localStorage.setItem('notify_dismissed_count', String(count + 1))
            localStorage.setItem('notify_dismissed_at', String(Date.now()))
          }}
        />
      )}

      <div className="min-h-screen bg-gray-50 pb-[80px]">

        {/* ── Update banner ──────────────────────────────── */}
        {hasUpdate && (
          <div className="bg-gradient-to-r from-[#0099CC] to-[#003a6e] text-white px-4 py-2.5 flex items-center gap-3 z-30 relative">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold leading-tight">Nova versão disponível!</p>
              <p className="text-[10px] text-white/70 leading-tight">Atualize para continuar usando o bolão corretamente.</p>
            </div>
            <button
              onClick={async () => {
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
              }}
              className="flex-shrink-0 bg-white text-[#0099CC] text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors hover:bg-white/90 whitespace-nowrap">
              Atualizar agora
            </button>
            <button
              onClick={() => {
                if (latestVersionRef.current) sessionStorage.setItem('app_version', latestVersionRef.current)
                sessionStorage.removeItem('app_update_pending')
                setHasUpdate(false)
              }}
              className="flex-shrink-0 text-white/50 hover:text-white/80 transition-colors p-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── Notification activation banner ──────────────── */}
        {player && !notifyEnabled && !notifyBannerHidden && (typeof Notification === 'undefined' || Notification.permission !== 'denied') && (
          <div className="bg-[#003a6e] text-white px-4 py-3 flex items-center gap-3">
            {/* Icon */}
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold leading-tight text-white">Não perca nenhum jogo!</p>
              <p className="text-[10px] text-white/65 leading-snug mt-0.5">
                Ative as notificações e receba avisos dos jogos e seus palpites na hora certa.
              </p>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Install button — show if not installed yet */}
              {showInstallBanner && (
                <button onClick={handleInstallClick}
                  className="text-[10px] font-semibold text-white/80 border border-white/20 hover:bg-white/10 px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                  {isIos ? 'Instalar' : 'Instalar'}
                </button>
              )}
              {/* Activate notifications */}
              <button
                onClick={async () => {
                  setShowNotifyModal(false)
                  const ok = await subscribeToPush()
                  if (!ok && isIos && !window.matchMedia('(display-mode: standalone)').matches) {
                    setShowIosModal(true)
                  }
                }}
                className="text-[11px] font-bold bg-[#0099CC] hover:bg-[#007aa8] text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Ativar agora
              </button>
              {/* Dismiss */}
              <button
                onClick={() => {
                  const count = parseInt(localStorage.getItem('notify_dismissed_count') || '0')
                  localStorage.setItem('notify_dismissed_count', String(count + 1))
                  localStorage.setItem('notify_dismissed_at', String(Date.now()))
                  // Force re-render by toggling state
                  setNotifyEnabled(false)
                  // Hide banner temporarily by setting a flag
                  sessionStorage.setItem('notify_banner_hidden', '1')
                  window.dispatchEvent(new Event('notify_banner_hide'))
                }}
                className="text-white/40 hover:text-white/70 transition-colors p-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Install Banner ─────────────────────────────── */}
        {showInstallBanner && (
          <div className="bg-gradient-to-r from-[#002240] to-[#003a6e] text-white px-4 py-2.5 flex items-center gap-3"
            style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
            <img src="/copa2026-logo.jpg" alt="Copa 2026"
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold leading-tight truncate">Instalar o app do Bolão</p>
              <p className="text-[10px] text-white/60 leading-tight">
                {isIos ? 'Toque para ver como instalar' : 'Acesso rápido na tela inicial'}
              </p>
            </div>
            <button
              onClick={handleInstallClick}
              className="flex-shrink-0 bg-[#0099CC] hover:bg-[#007aa8] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              {isIos ? 'Como instalar' : 'Instalar'}
            </button>
            <button onClick={dismissBanner}
              className="flex-shrink-0 text-white/50 hover:text-white/80 transition-colors p-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── Top header ──────────────────────────────────── */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">

            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <img src="/copa2026-logo.jpg" alt="Copa 2026"
                className="h-9 w-9 rounded-lg object-cover flex-shrink-0"/>
              <div className="hidden sm:flex flex-col">
                <span className="text-[13px] text-gray-600 font-bold leading-tight">Bolão Copa 2026 BEL</span>
                <span className="text-[9px] text-gray-400 font-medium">v1.15</span>
              </div>
              <span className="text-[9px] text-gray-400 font-medium sm:hidden bg-gray-100 px-1.5 py-0.5 rounded-full">v1.15</span>
            </div>

            {/* Tutorial button */}
            <button
              onClick={() => setShowTutorial(true)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#0099CC] bg-[#E6F4FA] hover:bg-[#d0ebf7] border border-[#0099CC]/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span className="hidden xs:inline">Tutorial</span>
            </button>

            {/* WhatsApp group button — center, visible when configured */}
            {groupLink && (
              <a href={groupLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg transition-colors shadow-sm whitespace-nowrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span className="hidden xs:inline">Grupo</span>
              </a>
            )}

            {/* Right side */}
            <div className="flex items-center gap-1.5">
              {/* Push notification bell + history dropdown */}
              {player && (
                <div className="relative">
                  <button
                    ref={bellRef}
                    title={notifyEnabled ? 'Notificações' : 'Ativar notificações'}
                    onClick={() => {
                      if (!notifyEnabled) { setShowNotifyModal(true); return }
                      if (!showNotifyLog) fetchNotifyLog()
                      setShowNotifyLog(v => !v)
                    }}
                    className={`relative p-1.5 rounded-lg transition-colors ${
                      notifyEnabled
                        ? 'text-green-500 bg-green-50 hover:bg-green-100'
                        : 'text-gray-400 hover:text-[#0099CC] hover:bg-gray-100'
                    }`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    {notifyEnabled && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 border border-white"/>
                    )}
                    {!notifyEnabled && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-400 border border-white animate-pulse"/>
                    )}
                    {/* Unread badge */}
                    {notifyEnabled && notifyLog.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#0099CC] text-white text-[8px] font-bold flex items-center justify-center border border-white">
                        {notifyLog.length}
                      </span>
                    )}
                  </button>

                  {/* Dropdown */}
                  {showNotifyLog && notifyEnabled && (
                    <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotifyLog(false)}/>
                      {/* Card */}
                      <div className="absolute right-0 top-10 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                          <p className="text-[13px] font-semibold text-gray-800">Notificações</p>
                          {notifyLog.length > 0 && (
                            <button
                              onClick={async () => {
                                setNotifyLog([])
                              }}
                              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">
                              Limpar
                            </button>
                          )}
                        </div>
                        {/* List */}
                        {loadingLog ? (
                          <div className="px-4 py-8 flex justify-center">
                            <span className="w-6 h-6 border-2 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin"/>
                          </div>
                        ) : notifyLog.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-2">
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                            </svg>
                            <p className="text-[12px] text-gray-400">Nenhum aviso recebido ainda</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {notifyLog.map((n, i) => (
                              <div key={i} className="px-4 py-3">
                                <p className="text-[12px] font-semibold text-gray-800 leading-tight">{n.title}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                                <p className="text-[10px] text-gray-300 mt-1">
                                  {new Date(n.time).toLocaleString('pt-BR', {
                                    timeZone: 'America/Sao_Paulo',
                                    day: '2-digit', month: '2-digit',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Footer */}
                        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                          <p className="text-[10px] text-gray-400 text-center">
                            Últimos {notifyLog.length > 0 ? notifyLog.length : 0} de 5 avisos
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Admin badge */}
              {isAdmin && (
                <button onClick={() => router.push('/admin')}
                  className="flex items-center gap-1.5 text-[11px] text-amber-700 border border-amber-200 bg-amber-50 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-amber-100 transition-colors">
                  <IconSettings size={12}/> Admin
                </button>
              )}

              {/* Payment button */}
              {!player?.payment_ok && (
                <button onClick={() => router.push('/pagar')}
                  className="flex items-center gap-1 text-[11px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shadow-sm">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Pagar R$10
                </button>
              )}

              {/* Avatar */}
              <button onClick={() => router.push('/profile-setup')}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity ml-1">
                {avatarSrc ? (
                  <img key={avatarSrc} src={avatarSrc} alt={displayName}
                    className="w-8 h-8 rounded-full object-cover border-2 border-[#0099CC]/20 shadow-sm"
                    onError={() => setAvatarSrc(null)}/>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[11px] font-bold text-[#0099CC] border-2 border-[#0099CC]/10">
                    {initials}
                  </div>
                )}
              </button>

              {/* Logout */}
              <button onClick={handleLogout} title="Sair"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <IconLogout size={16}/>
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main>{children}</main>

        {/* ── Bottom nav ──────────────────────────────────── */}
        {/* Update loading overlay */}
        {isUpdating && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4"
            style={{transform:'translateZ(0)'}}>
            <span className="w-10 h-10 border-3 border-[#0099CC]/20 border-t-[#0099CC] rounded-full animate-spin" style={{borderWidth:3}}/>
            <p className="text-[14px] font-semibold text-gray-700">Atualizando...</p>
            <p className="text-[11px] text-gray-400">Aguarde um momento</p>
          </div>
        )}

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
          }}>
          <div className="max-w-lg mx-auto flex items-center">
            {watchAtivo ? (
              // 5 slots: 2 à esquerda + botão flutuante central + 2 à direita
              <>
                {NAV_LEFT.map(({ href, Icon, label }) => {
                  const isActive = router.pathname === href
                  return (
                    <button key={href} onClick={() => router.push(href)}
                      className={`flex-1 flex flex-col items-center justify-center pt-3 pb-1 gap-1 transition-colors relative
                        ${isActive ? 'text-[#0099CC]' : 'text-gray-400 hover:text-gray-500'}`}>
                      {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#0099CC] rounded-full"/>}
                      <Icon size={22}/>
                      <span className="text-[11px] font-semibold tracking-wide">{label}</span>
                    </button>
                  )
                })}
                {/* Botão flutuante central */}
                <div className="flex-1 flex flex-col items-center" style={{ marginTop: -22 }}>
                  <div className="relative">
                    {hasLive && (
                      <span className="absolute -top-1 -right-1 z-10 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none border-2 border-white">
                        ao vivo
                      </span>
                    )}
                    <button
                      onClick={() => router.push('/watch')}
                      className={`w-14 h-14 rounded-full flex items-center justify-center border-4 border-white transition-transform active:scale-95
                        ${router.pathname === '/watch' ? 'bg-[#007aa8]' : 'bg-[#0099CC]'}`}
                      style={{ boxShadow: '0 0 0 1px #e5e7eb' }}
                      aria-label="Assistir ao vivo">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </button>
                  </div>
                  <span className={`text-[11px] font-semibold tracking-wide mt-1.5 ${router.pathname === '/watch' ? 'text-[#0099CC]' : 'text-gray-400'}`}>
                    Assistir
                  </span>
                </div>
                {NAV_RIGHT.map(({ href, Icon, label }) => {
                  const isActive = router.pathname === href
                  return (
                    <button key={href} onClick={() => router.push(href)}
                      className={`flex-1 flex flex-col items-center justify-center pt-3 pb-1 gap-1 transition-colors relative
                        ${isActive ? 'text-[#0099CC]' : 'text-gray-400 hover:text-gray-500'}`}>
                      {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#0099CC] rounded-full"/>}
                      <Icon size={22}/>
                      <span className="text-[11px] font-semibold tracking-wide">{label}</span>
                    </button>
                  )
                })}
              </>
            ) : (
              // 4 slots distribuídos uniformemente quando Assistir está desativado
              [...NAV_LEFT, ...NAV_RIGHT].map(({ href, Icon, label }) => {
                const isActive = router.pathname === href
                return (
                  <button key={href} onClick={() => router.push(href)}
                    className={`flex-1 flex flex-col items-center justify-center pt-3 pb-1 gap-1 transition-colors relative
                      ${isActive ? 'text-[#0099CC]' : 'text-gray-400 hover:text-gray-500'}`}>
                    {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#0099CC] rounded-full"/>}
                    <Icon size={22}/>
                    <span className="text-[11px] font-semibold tracking-wide">{label}</span>
                  </button>
                )
              })
            )}
          </div>
        </nav>
      </div>
    </>
  )
}
