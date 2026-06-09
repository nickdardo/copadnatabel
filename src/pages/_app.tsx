import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { AuthProvider } from '@/lib/auth'
import SplashScreen from '@/components/SplashScreen'
import '@/styles/globals.css'

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
      {showSplash && <SplashScreen onDone={handleSplashDone}/>}

      <div style={{ opacity: showSplash ? 0 : 1, transition: 'opacity 0.4s ease' }}>
        <Component {...pageProps}/>
      </div>
    </AuthProvider>
  )
}
