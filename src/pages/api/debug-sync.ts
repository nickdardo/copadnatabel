/**
 * GET /api/debug-sync
 * Diagnóstico do sync — use só para testar, depois pode remover
 * Acesse: https://copadnatabel.vercel.app/api/debug-sync?secret=SEU_ADMIN_NICKNAME
 */
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminNick  = process.env.NEXT_PUBLIC_ADMIN_NICKNAME?.toLowerCase()
  const querySecret = (req.query?.secret as string)?.toLowerCase()
  if (adminNick && querySecret !== adminNick) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const results: Record<string, any> = {}

  // 1. Check env vars (without exposing values)
  results.env = {
    NEXT_PUBLIC_SUPABASE_URL:      !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY:     !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ODDS_API_KEY:                  !!process.env.ODDS_API_KEY,
    CRON_SECRET:                   !!process.env.CRON_SECRET,
    NEXT_PUBLIC_ADMIN_NICKNAME:    !!process.env.NEXT_PUBLIC_ADMIN_NICKNAME,
  }

  // 2. Test The Odds API
  try {
    const apiKey = process.env.ODDS_API_KEY
    if (!apiKey) {
      results.odds_api = { error: 'ODDS_API_KEY not set' }
    } else {
      const r = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/events?apiKey=${apiKey}&dateFormat=iso`,
        { cache: 'no-store' }
      )
      const quota = r.headers.get('x-requests-remaining')
      if (r.ok) {
        const data = await r.json()
        results.odds_api = {
          ok: true,
          events_count: data.length,
          quota_remaining: quota,
          first_event: data[0] ? {
            id: data[0].id,
            home: data[0].home_team,
            away: data[0].away_team,
            date: data[0].commence_time,
          } : null,
          last_event: data[data.length-1] ? {
            home: data[data.length-1].home_team,
            away: data[data.length-1].away_team,
            date: data[data.length-1].commence_time,
          } : null,
        }
      } else {
        const txt = await r.text()
        results.odds_api = { error: txt, status: r.status, quota_remaining: quota }
      }
    }
  } catch (e: any) {
    results.odds_api = { error: e.message }
  }

  // 3. Test Supabase connection
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error, count } = await sb.from('matches').select('*', { count: 'exact', head: true })
    results.supabase = {
      ok: !error,
      matches_count: count,
      using_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      error: error?.message,
    }
  } catch (e: any) {
    results.supabase = { error: e.message }
  }

  return res.status(200).json(results)
}
