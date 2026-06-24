// GET /api/version
// Returns current app version — always fresh, never cached
// Update APP_VERSION after each deploy to force client refresh.
// APP_CHANGELOG é opcional: se setado na Vercel, sobrescreve o resumo
// padrão sem precisar de novo deploy de código — só o admin trocar a
// env var e re-deployar (mesmo passo que já faz pro APP_VERSION).
import type { NextApiRequest, NextApiResponse } from 'next'

const APP_VERSION = process.env.APP_VERSION || '1.0.0'

const DEFAULT_CHANGELOG = [
  'Avisos de atualização que apareciam e fechavam rápido demais — corrigido',
  'Notificação de gol com seu palpite e os pontos na hora',
  'Grupo e colocação direto no card do jogo',
  'Menu inferior mais moderno no celular',
].join('\n')

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Never cache this endpoint
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.json({ version: APP_VERSION, changelog: process.env.APP_CHANGELOG || DEFAULT_CHANGELOG })
}
