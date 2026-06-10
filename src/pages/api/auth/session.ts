import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { serialize, parse } from 'cookie'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COOKIE_NAME = 'bolao_session'
const MAX_AGE    = 90 * 24 * 60 * 60

function generateToken(): string {
  const arr = new Uint8Array(32)
  if (typeof crypto !== 'undefined') crypto.getRandomValues(arr)
  else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { player_id } = req.body
    if (!player_id) return res.status(400).json({ error: 'player_id required' })
    const token     = generateToken()
    const expiresAt = new Date(Date.now() + MAX_AGE * 1000)
    const { error } = await admin.from('session_tokens').insert({ player_id, token, expires_at: expiresAt.toISOString() })
    if (error) return res.status(500).json({ error: error.message })
    res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: MAX_AGE, path: '/' }))
    return res.json({ ok: true, token })
  }

  if (req.method === 'GET') {
    const cookies = parse(req.headers.cookie || '')
    const token   = cookies[COOKIE_NAME] || (req.query.token as string)
    if (!token) return res.status(401).json({ error: 'No session' })
    const { data } = await admin.from('session_tokens').select('player_id, expires_at').eq('token', token).single()
    if (!data) return res.status(401).json({ error: 'Invalid session' })
    if (new Date(data.expires_at) < new Date()) {
      await admin.from('session_tokens').delete().eq('token', token)
      return res.status(401).json({ error: 'Session expired' })
    }
    await admin.from('session_tokens').update({ last_used: new Date().toISOString() }).eq('token', token)
    const { data: player } = await admin.from('players').select('*').eq('id', data.player_id).single()
    if (!player) return res.status(404).json({ error: 'Player not found' })
    res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: MAX_AGE, path: '/' }))
    return res.json({ ok: true, player })
  }

  if (req.method === 'DELETE') {
    const cookies = parse(req.headers.cookie || '')
    const token   = cookies[COOKIE_NAME]
    if (token) await admin.from('session_tokens').delete().eq('token', token)
    res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0, path: '/' }))
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
