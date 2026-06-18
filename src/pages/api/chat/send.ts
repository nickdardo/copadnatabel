// POST /api/chat/send
// Insere uma mensagem no chat usando a chave de serviço (service_role),
// que ignora RLS completamente — elimina qualquer problema de policy.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { player_id, player_name, player_avatar, message } = req.body
  if (!player_id || !player_name || !message?.trim())
    return res.status(400).json({ error: 'campos obrigatórios ausentes' })
  if (message.length > 280)
    return res.status(400).json({ error: 'mensagem muito longa' })

  const { data, error } = await admin.from('chat_messages').insert({
    player_id,
    player_name,
    player_avatar: player_avatar || null,
    message: message.trim(),
    created_at: new Date().toISOString(),
  }).select().single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true, msg: data })
}
