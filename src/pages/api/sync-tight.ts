// GET/POST /api/sync-tight
// Sync de alta frequência, pensado pra ser chamado a cada 1 minuto por um
// cron externo (cron-job.org), o tempo todo, 24h por dia, durante a Copa.
// Na maioria das chamadas não tem nenhum jogo na janela apertada (10min
// antes até 100min depois do início) — nesse caso, nem chega a chamar o
// football-data.org, então não tem custo real fora dos jogos.
//
// Protegida pela mesma variável CRON_SECRET já usada em /api/sync.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { syncTightWindow } from '@/lib/footballDataSync'
import { notifyGoalEvents } from '@/lib/goalNotify'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers['authorization']
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const result = await syncTightWindow()

  // Marca separado do sync principal — esse aqui fica "parado" o tempo
  // todo fora da janela de jogo, então não dá pra usar o mesmo alerta de
  // "sincronização parada" do /api/sync sem confundir o admin.
  const { data: cfgRows } = await admin.from('pix_config').select('id').limit(1)
  if (cfgRows?.[0]) {
    await admin.from('pix_config').update({
      last_tight_sync_at: new Date().toISOString(),
      last_tight_sync_ok: !result.error,
    }).eq('id', cfgRows[0].id)
  }

  if (!result.error && result.updated > 0) {
    await admin.rpc('recalc_all_scores')
  }

  let goalsNotified = 0
  if (!result.error && result.goalEvents.length > 0) {
    const { notified } = await notifyGoalEvents(result.goalEvents)
    goalsNotified = notified
  }

  return res.status(200).json({ ok: !result.error, ...result, goalsNotified, timestamp: new Date().toISOString() })
}
