import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { IconTrophy, IconBall, IconBarChart, IconSettings, IconLogout, IconInfo } from '@/components/Icons'

// Bottom nav — Regras no centro
const NAV = [
  { href: '/champion',   Icon: IconTrophy,    label: 'Campeão'  },
  { href: '/picks',      Icon: IconBall,      label: 'Palpites' },
  { href: '/ranking',    Icon: IconBarChart,  label: 'Ranking'  },
  { href: '/onboarding', Icon: IconInfo,      label: 'Regras'   },
]

type Props = { children?: React.ReactNode; title: string; step?: number }

export default function Layout({ children, title }: Props) {
  const router    = useRouter()
  const { player, logout, isAdmin, refreshPlayer } = useAuth()
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)

  // Refresh player on route change
  useEffect(() => { refreshPlayer() }, [router.pathname])

  // Resolve avatar URL
  useEffect(() => {
    if (!player?.avatar_url) { setAvatarSrc(null); return }
    if (player.avatar_url.startsWith('http')) {
      setAvatarSrc(player.avatar_url + '?v=' + Date.now()); return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(player.avatar_url)
    setAvatarSrc(data.publicUrl + '?v=' + Date.now())
  }, [player?.avatar_url])

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

      <div className="min-h-screen bg-gray-50 pb-[68px]">

        {/* ── Top header ──────────────────────────────────── */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">

            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <img src="/copa2026-logo.jpg" alt="Copa 2026"
                className="h-9 w-9 rounded-lg object-cover flex-shrink-0"/>
              <span className="text-[13px] text-gray-600 font-bold hidden sm:block">Bolão Copa 2026 BEL</span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1.5">
              {/* Admin badge */}
              {isAdmin && (
                <button onClick={() => router.push('/admin')}
                  className="flex items-center gap-1.5 text-[11px] text-amber-700 border border-amber-200 bg-amber-50 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-amber-100 transition-colors">
                  <IconSettings size={12}/> Admin
                </button>
              )}

              {/* Payment button — always visible */}
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
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20 safe-area-bottom">
          <div className="max-w-lg mx-auto flex">
            {NAV.map(({ href, Icon, label }) => {
              const isActive = router.pathname === href
              return (
                <button key={href} onClick={() => router.push(href)}
                  className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative
                    ${isActive ? 'text-[#0099CC]' : 'text-gray-400 hover:text-gray-500'}`}>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#0099CC] rounded-full"/>
                  )}
                  <Icon size={20}/>
                  <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}
