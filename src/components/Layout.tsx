'use client'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import Head from 'next/head'

const NAV = [
  { href: '/champion', icon: '🏆', label: 'Campeão' },
  { href: '/picks',    icon: '⚽', label: 'Palpites' },
  { href: '/ranking',  icon: '📊', label: 'Ranking'  },
]

type Props = {
  children: React.ReactNode
  title: string
  step?: number
}

export default function Layout({ children, title, step }: Props) {
  const router  = useRouter()
  const { player, logout, isAdmin } = useAuth()

  function handleLogout() {
    logout()
    router.push('/')
  }

  return (
    <>
      <Head>
        <title>{title} · Bolão Copa 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#1D9E75" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10 safe-area-top">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#1D9E75] font-bold text-base">Bolão Copa 2026</span>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="text-xs text-amber-600 border border-amber-200 bg-amber-50 px-2 py-1 rounded-lg"
                >
                  ⚙️ Admin
                </button>
              )}
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-[#E1F5EE] flex items-center justify-center text-xs font-semibold text-[#1D9E75]">
                  {player?.nickname?.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm text-gray-700 hidden sm:block">{player?.nickname}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-gray-600 ml-1"
                title="Sair"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main>{children}</main>

        {/* Bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-10">
          <div className="max-w-lg mx-auto flex">
            {NAV.map(item => {
              const isActive = router.pathname === item.href
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors
                    ${isActive ? 'text-[#1D9E75]' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <span className="text-xl leading-none">{item.icon}</span>
                  <span className={`text-[10px] font-medium ${isActive ? 'text-[#1D9E75]' : 'text-gray-400'}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 w-8 h-0.5 bg-[#1D9E75] rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}
