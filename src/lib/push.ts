// Pede permissão de notificação no navegador e registra a inscrição push do
// jogador no banco. Usado pelo banner de notificação em Layout.tsx e também
// pelo popup central de atualização em _app.tsx (convite pra ativar o sino).
export async function subscribeToPush(playerId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
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
      body: JSON.stringify({ player_id: playerId, subscription: sub }),
    })
    return true
  } catch {
    return false
  }
}
