import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Aplica o palpite automático (0×0, marcado como is_auto) para todo jogador
 * pagante que não registrou palpite no jogo informado. Idempotente: seguro
 * de chamar mais de uma vez para o mesmo jogo (usa upsert com onConflict,
 * e nunca sobrescreve um palpite real já existente).
 *
 * Chamado tanto quando o sync automático detecta um jogo encerrado quanto
 * quando o admin usa o botão "Finalizar jogo" manualmente.
 */
export async function applyAutoPicksForMatch(matchId: string): Promise<{ inserted: number; error?: string }> {
  const { data: paidPlayers, error: playersErr } = await admin
    .from('players')
    .select('id')
    .eq('payment_ok', true)
    .eq('is_admin', false)
  if (playersErr) return { inserted: 0, error: playersErr.message }

  const { data: existingPicks, error: picksErr } = await admin
    .from('picks')
    .select('player_id')
    .eq('match_id', matchId)
  if (picksErr) return { inserted: 0, error: picksErr.message }

  const alreadyPicked = new Set((existingPicks || []).map(p => p.player_id))
  const missing = (paidPlayers || []).filter(p => !alreadyPicked.has(p.id))
  if (missing.length === 0) return { inserted: 0 }

  const rows = missing.map(p => ({
    player_id: p.id,
    match_id: matchId,
    pick_home: 0,
    pick_away: 0,
    is_auto: true,
    submitted_at: new Date().toISOString(),
  }))

  // Insert puro (não upsert): se por uma corrida rara o jogador tiver
  // registrado um palpite real entre a busca acima e este insert, a
  // constraint única (player_id, match_id) rejeita a inserção em vez de
  // sobrescrever o palpite verdadeiro. Esse erro específico é esperado e
  // seguro de ignorar — só significa que o jogador chegou primeiro.
  const { error: insertErr } = await admin.from('picks').insert(rows)
  if (insertErr && !insertErr.message.toLowerCase().includes('duplicate')) {
    return { inserted: 0, error: insertErr.message }
  }

  return { inserted: rows.length }
}
