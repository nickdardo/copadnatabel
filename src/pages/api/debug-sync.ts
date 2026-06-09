import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Temporarily open — remove after debugging
  const results: Record<string, any> = {}

  // 1. Env vars check
  results.env = {
    NEXT_PUBLIC_SUPABASE_URL:      !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY:     !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ODDS_API_KEY:                  !!process.env.ODDS_API_KEY,
    CRON_SECRET:                   !!process.env.CRON_SECRET,
    NEXT_PUBLIC_ADMIN_NICKNAME:    process.env.NEXT_PUBLIC_ADMIN_NICKNAME || 'NOT SET',
  }

  // 2. Test Odds API
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
          first_event: data[0] ? { home: data[0].home_team, away: data[0].away_team, date: data[0].commence_time } : null,
        }
      } else {
        results.odds_api = { error: await r.text(), status: r.status }
      }
    }
  } catch (e: any) {
    results.odds_api = { error: e.message }
  }

  // 3. Test Supabase
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const sb  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
    const { count, error } = await sb.from('matches').select('*', { count: 'exact', head: true })
    results.supabase = {
      ok: !error,
      matches_in_db: count,
      using_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      error: error?.message,
    }
  } catch (e: any) {
    results.supabase = { error: e.message }
  }

  return res.status(200).json(results)
}
