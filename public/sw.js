const CACHE_NAME = 'bolao-v1'
const STATIC_ASSETS = ['/', '/champion', '/picks', '/ranking', '/copa2026-logo.jpg', '/manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  // Never cache these — always fresh
  if (e.request.url.includes('/api/')) return
  if (e.request.url.includes('/api/version')) return
  if (e.request.url.includes('supabase')) return
  if (e.request.url.includes('_next/webpack-hmr')) return
  // Don't cache JS/CSS chunks — let browser handle normally
  if (e.request.url.includes('_next/static/chunks')) return
  if (e.request.url.includes('_next/static/css')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'Bolão Copa 2026 BEL', body: e.data.text() } }

  const title = data.title || 'Bolão Copa 2026 BEL'
  const body  = data.body  || ''

  e.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon:    data.icon  || '/icon-192.png',
        badge:   data.badge || '/icon-192.png',
        vibrate: [200, 100, 200],
        data:    { url: data.url || '/' },
      }),
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'PUSH_RECEIVED', title, body }))
      }),
    ])
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      const existing = windowClients.find(c => c.url === url && 'focus' in c)
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

// Listen for skip-waiting message from update flow
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting()
})
