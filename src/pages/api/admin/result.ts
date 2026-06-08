/**
 * POST /api/admin/result
 * Body: { matchId, scoreHome, scoreAway, secret }
 *
 * Allows admin to manually override a result
 * (e.g. after penalties where the API might report ET score)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { matchId, scoreHome, scoreAway, secret } = req.body

  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!matchId || scoreHome === undefined || scoreAway === undefined) {
    return res.status(400).json({ error: 'matchId, scoreHome, scoreAway required' })
  }

  const { error } = await supabaseAdmin
    .from('matches')
    .update({ score_home: Number(scoreHome), score_away: Number(scoreAway), status: 'done' })
    .eq('id', matchId)

  if (error) return res.status(500).json({ error: error.message })

  // Recalc
  await supabaseAdmin.rpc('recalc_all_scores')

  return res.status(200).json({ ok: true })
}
