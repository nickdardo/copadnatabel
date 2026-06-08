import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth'
import Head from 'next/head'
import { IconTrophy, IconBall, IconBarChart, IconSettings, IconLogout, IconUser } from '@/components/Icons'

const NAV = [
  { href: '/champion', Icon: IconTrophy,   label: 'Campeão'  },
  { href: '/picks',    Icon: IconBall,      label: 'Palpites' },
  { href: '/ranking',  Icon: IconBarChart,  label: 'Ranking'  },
]

type Props = {
  children: React.ReactNode
  title: string
  step?: number
}

export default function Layout({ children, title, step }: Props) {
  const router = useRouter()
  const { player, logout, isAdmin } = useAuth()

  function handleLogout() {
    logout()
    router.push('/')
  }

  // Initials from full name
  const initials = player?.nickname
    ? player.nickname.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??'

  return (
    <>
      <Head>
        <title>{title} · Bolão Copa 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0099CC" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      <div className="min-h-screen bg-gray-50 pb-20">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">

            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <img src="/dnata-logo.png" alt="dnata" className="h-6 w-auto" />
              <div className="h-4 w-px bg-gray-200" />
              <span className="text-[13px] text-gray-400 font-medium">Bolão Copa 2026</span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-1.5 text-[11px] text-amber-700 border border-amber-200 bg-amber-50 px-2.5 py-1 rounded-lg font-medium"
                >
                  <IconSettings size={13} />
                  Admin
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[11px] font-bold text-[#0099CC]">
                  {initials}
                </div>
                <span className="text-[13px] text-gray-700 font-medium hidden sm:block max-w-[120px] truncate">
                  {player?.nickname}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors ml-1"
                title="Sair"
              >
                <IconLogout size={14} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main>{children}</main>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-10">
          <div className="max-w-lg mx-auto flex">
            {NAV.map(({ href, Icon, label }) => {
              const isActive = router.pathname === href
              return (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors relative
                    ${isActive ? 'text-[#0099CC]' : 'text-gray-400 hover:text-gray-500'}`}
                >
                  <Icon size={20} />
                  <span className="text-[10px] font-semibold tracking-wide">
                    {label}
                  </span>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#0099CC] rounded-full" />
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
