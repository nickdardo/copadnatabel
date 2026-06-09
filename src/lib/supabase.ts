import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnon)

export type Player = {
  id: string; username: string; nickname: string
  avatar_url?: string; payment_ok: boolean; is_admin: boolean; created_at: string
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

// PWA BeforeInstallPromptEvent (not in default TS types)
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}
