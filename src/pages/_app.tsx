import type { AppProps } from 'next/app'
import Head from 'next/head'
import { AuthProvider } from '@/lib/auth'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
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
      </Head>
      <Component {...pageProps}/>
    </AuthProvider>
  )
}
