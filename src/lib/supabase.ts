import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnon)

export type Player = {
  id: string; username: string; nickname: string
  avatar_url?: string; payment_ok: boolean; is_admin: boolean
  created_at: string; last_seen_at?: string
}

/** Returns online status based on last_seen_at.
 *  online  = seen within 2 minutes
 *  recent  = seen within 24 hours (show relative time)
 *  offline = never seen or >24h
 */
export function getPresence(last_seen_at?: string): {
  status: 'online' | 'recent' | 'offline'
  label: string
} {
  if (!last_seen_at) return { status: 'offline', label: 'Nunca visto' }
  const diff = Date.now() - new Date(last_seen_at).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  if (diff < 2 * 60_000)   return { status: 'online',  label: 'Online agora' }
  if (mins  < 60)          return { status: 'recent',  label: `${mins}min atrás` }
  if (hours < 24)          return { status: 'recent',  label: `${hours}h atrás` }
  const days = Math.floor(diff / 86_400_000)
  if (days < 7)            return { status: 'offline', label: `${days}d atrás` }
  return { status: 'offline', label: 'Mais de 1 semana' }
}
export type Match = {
  id: string; home_team: string; away_team: string
  home_flag?: string; away_flag?: string; match_date?: string
  fase: string; status: 'upcoming'|'live'|'done'
  score_home?: number; score_away?: number
  sort_order: number; odds_event_id?: string; group_name?: string
}
export type Pick = {
  id: string; player_id: string; match_id: string
  pick_home: number; pick_away: number; submitted_at: string; edit_count: number
}
export type ChampionPick = {
  id: string; player_id: string
  pick_champion: string; pick_runner: string; pick_third: string; locked: boolean
}
export type Score = {
  player_id: string; total_pts: number
  f10_count: number; f7_count: number; f5_count: number; f2_count: number; f0_count: number
  champion_pts: number; picks_count: number; updated_at: string
}
export type EditLimit = {
  player_id: string; fase: string; round_index: number; edits_used: number; max_edits: number
}

export function calcFactor(pH:number,pA:number,rH:number,rA:number):'F10'|'F7'|'F5'|'F2'|'F0' {
  const pr = pH>pA?'H':pH<pA?'A':'D', rr = rH>rA?'H':rH<rA?'A':'D'
  if (pH===rH&&pA===rA) return 'F10'
  if (pr===rr&&(pH===rH||pA===rA)) return 'F7'
  if (pr===rr) return 'F5'
  if (pH===rH||pA===rA) return 'F2'
  return 'F0'
}
export const FACTOR_PTS: Record<string,number> = {F10:10,F7:7,F5:5,F2:2,F0:0}
export const FACTOR_LABEL: Record<string,string> = {
  F10: 'Acertou tudo!',
  F7:  'Vencedor + 1 gol',
  F5:  'Acertou o vencedor',
  F2:  'Acertou 1 gol',
  F0:  'Nenhum acerto',
}
export const FACTOR_COLOR: Record<string,string> = {
  F10:'bg-green-100 text-green-800', F7:'bg-blue-100 text-blue-800',
  F5:'bg-amber-100 text-amber-800',  F2:'bg-pink-100 text-pink-800',
  F0:'bg-gray-100 text-gray-600',
}
export const FASE_ORDER = ['Fase de Grupos','Oitavas de Final','Quartas de Final','Semifinais','Terceiro Lugar','Final']

export function getAvatarUrl(path:string|null|undefined):string|null {
  if (!path) return null
  if (path.startsWith('http')) return path + '?v=' + Date.now()
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl + '?v=' + Date.now()
}

// Screen Wake Lock API (not in all TS versions)
declare global {
  interface WakeLockSentinel {
    release(): Promise<void>
  }
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}
