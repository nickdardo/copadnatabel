// GET /api/version
// Returns current app version — always fresh, never cached
// Update APP_VERSION after each deploy to force client refresh
import type { NextApiRequest, NextApiResponse } from 'next'

const APP_VERSION = process.env.APP_VERSION || '1.0.0'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Never cache this endpoint
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.json({ version: APP_VERSION })
}
