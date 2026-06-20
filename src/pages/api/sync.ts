import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { syncFromOddsAPI } from '@/lib/oddsSync'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  // Only protect with CRON_SECRET if it's set (for Vercel cron jobs)
  // Manual calls from admin panel are allowed freely
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers['authorization']
    // Only enforce for automated cron calls (Authorization header)
    // Manual POST calls from admin panel bypass this check
    if (auth && auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const result = await syncFromOddsAPI()

  // Registra o horário desta execução no banco — é essa marca que o painel
  // admin usa para detectar quando a sincronização parou de rodar, mesmo que
  // ninguém tenha o navegador aberto para ver isso acontecer em tempo real.
  const { data: cfgRows } = await admin.from('pix_config').select('id').limit(1)
  if (cfgRows?.[0]) {
    await admin.from('pix_config').update({
      last_sync_at: new Date().toISOString(),
      last_sync_ok: !result.error,
    }).eq('id', cfgRows[0].id)
  }

  // Recalcula o ranking sempre que o sync trouxer algo novo — assim quem
  // depende do cron (sem o painel admin aberto) também tem o ranking
  // sempre atualizado, sem precisar de nenhum delay manual de 3 minutos.
  let recalcError: string | null = null
  if (!result.error && ((result.synced ?? 0) > 0 || (result.updated ?? 0) > 0)) {
    const { error } = await admin.rpc('recalc_all_scores')
    if (error) recalcError = error.message
  }

  return res.status(200).json({ ok: !result.error, ...result, recalcError, timestamp: new Date().toISOString() })
}
