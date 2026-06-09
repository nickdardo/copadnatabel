// ─── Flag map — PT + EN + alternates ────────────────────────────
// Covers both Supabase manual inserts (PT) and The Odds API names (EN)

export const FLAG_MAP: Record<string, string> = {
  // ── Portuguese names ──────────────────────────────────────────
  'Albania':'🇦🇱','Alemanha':'🇩🇪','Argentina':'🇦🇷','Arábia Saudita':'🇸🇦',
  'Austrália':'🇦🇺','Áustria':'🇦🇹','Bélgica':'🇧🇪','Bolívia':'🇧🇴',
  'Brasil':'🇧🇷','Camarões':'🇨🇲','Canadá':'🇨🇦','Cazaquistão':'🇰🇿',
  'Chile':'🇨🇱','Colômbia':'🇨🇴','Coreia do Sul':'🇰🇷','Costa Rica':'🇨🇷',
  'Croácia':'🇭🇷','Dinamarca':'🇩🇰','Equador':'🇪🇨','Eslováquia':'🇸🇰',
  'Eslovênia':'🇸🇮','Espanha':'🇪🇸','Estados Unidos':'🇺🇸','França':'🇫🇷',
  'Geórgia':'🇬🇪','Honduras':'🇭🇳','Hungria':'🇭🇺','Inglaterra':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Irã':'🇮🇷','Iraque':'🇮🇶','Israel':'🇮🇱','Itália':'🇮🇹',
  'Jamaica':'🇯🇲','Japão':'🇯🇵','Marrocos':'🇲🇦','México':'🇲🇽',
  'Moçambique':'🇲🇿','Nigéria':'🇳🇬','Noruega':'🇳🇴','Nova Zelândia':'🇳🇿',
  'Países Baixos':'🇳🇱','Panamá':'🇵🇦','Paraguai':'🇵🇾','Peru':'🇵🇪',
  'Portugal':'🇵🇹','RD Congo':'🇨🇩','Romênia':'🇷🇴','Sérvia':'🇷🇸',
  'Senegal':'🇸🇳','Suécia':'🇸🇪','Suíça':'🇨🇭','Tchéquia':'🇨🇿',
  'Turquia':'🇹🇷','Uruguai':'🇺🇾','Venezuela':'🇻🇪',
  // ── English names (The Odds API) ──────────────────────────────
  'Albania':'🇦🇱','Germany':'🇩🇪','Argentina':'🇦🇷','Saudi Arabia':'🇸🇦',
  'Australia':'🇦🇺','Austria':'🇦🇹','Belgium':'🇧🇪','Bolivia':'🇧🇴',
  'Brazil':'🇧🇷','Cameroon':'🇨🇲','Canada':'🇨🇦','Kazakhstan':'🇰🇿',
  'Chile':'🇨🇱','Colombia':'🇨🇴','South Korea':'🇰🇷','Korea Republic':'🇰🇷',
  'Costa Rica':'🇨🇷','Croatia':'🇭🇷','Denmark':'🇩🇰','Ecuador':'🇪🇨',
  'Slovakia':'🇸🇰','Slovenia':'🇸🇮','Spain':'🇪🇸','United States':'🇺🇸',
  'USA':'🇺🇸','France':'🇫🇷','Georgia':'🇬🇪','Honduras':'🇭🇳',
  'Hungary':'🇭🇺','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Iran':'🇮🇷','Iraq':'🇮🇶',
  'Israel':'🇮🇱','Italy':'🇮🇹','Jamaica':'🇯🇲','Japan':'🇯🇵',
  'Morocco':'🇲🇦','Mexico':'🇲🇽','Mozambique':'🇲🇿','Nigeria':'🇳🇬',
  'Norway':'🇳🇴','New Zealand':'🇳🇿','Netherlands':'🇳🇱','Panama':'🇵🇦',
  'Paraguay':'🇵🇾','Peru':'🇵🇪','Portugal':'🇵🇹','DR Congo':'🇨🇩',
  'Congo DR':'🇨🇩','Romania':'🇷🇴','Serbia':'🇷🇸','Senegal':'🇸🇳',
  'Sweden':'🇸🇪','Switzerland':'🇨🇭','Czech Republic':'🇨🇿','Czechia':'🇨🇿',
  'Turkey':'🇹🇷','Turkiye':'🇹🇷','Uruguay':'🇺🇾','Venezuela':'🇻🇪',
  'Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Poland':'🇵🇱','Greece':'🇬🇷',
  'Ukraine':'🇺🇦','Bosnia and Herzegovina':'🇧🇦','Bosnia-Herzegovina':'🇧🇦',
  'Qatar':'🇶🇦','Indonesia':'🇮🇩','South Africa':'🇿🇦','Trinidad and Tobago':'🇹🇹',
  'El Salvador':'🇸🇻','Cuba':'🇨🇺','Guatemala':'🇬🇹','Haiti':'🇭🇹',
  'Ivory Coast':'🇨🇮','Côte d\'Ivoire':'🇨🇮',"Cote d'Ivoire":'🇨🇮',
  'Ghana':'🇬🇭','Mali':'🇲🇱','Tunisia':'🇹🇳','Algeria':'🇩🇿',
  'Egypt':'🇪🇬','Finland':'🇫🇮','Romania':'🇷🇴','Northern Ireland':'🇬🇧',
  'Kosovo':'🇽🇰','Luxembourg':'🇱🇺','Cyprus':'🇨🇾','Lithuania':'🇱🇹',
  'Latvia':'🇱🇻','Estonia':'🇪🇪','Malta':'🇲🇹','Andorra':'🇦🇩',
  'San Marino':'🇸🇲','Faroe Islands':'🇫🇴','Iceland':'🇮🇸',
  'Switzerland':'🇨🇭','Netherlands':'🇳🇱','Belgium':'🇧🇪',
}

export function getFlag(team: string, dbFlag?: string): string {
  // DB flag (from Supabase) takes priority if it's a real emoji flag
  if (dbFlag && dbFlag !== '🏳️' && dbFlag.length > 0) return dbFlag
  // Exact match
  if (FLAG_MAP[team]) return FLAG_MAP[team]
  // Case-insensitive match
  const lower = team.toLowerCase()
  const found = Object.entries(FLAG_MAP).find(([k]) => k.toLowerCase() === lower)
  if (found) return found[1]
  // Partial match (e.g. "United States of America" → "United States")
  const partial = Object.entries(FLAG_MAP).find(([k]) =>
    lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  )
  if (partial) return partial[1]
  return '🏳️'
}

// PT name lookup (for champion picks stored in PT)
export const TEAMS_PT = Object.keys(FLAG_MAP)
  .filter(k => {
    const c = k.charCodeAt(0)
    return c >= 65 && c <= 122 // ASCII letters only (filter out EN duplicates by using PT first)
  })
  .filter((v, i, a) => a.indexOf(v) === i) // dedupe
  .sort()

export const TEAMS_SELECT = [
  'Albania','Alemanha','Argentina','Arábia Saudita','Austrália','Áustria',
  'Bélgica','Bolívia','Brasil','Camarões','Canadá','Cazaquistão','Chile',
  'Colômbia','Coreia do Sul','Costa Rica','Croácia','Dinamarca','Equador',
  'Eslováquia','Eslovênia','Espanha','Estados Unidos','França','Geórgia',
  'Honduras','Hungria','Inglaterra','Irã','Iraque','Israel','Itália',
  'Jamaica','Japão','Marrocos','México','Moçambique','Nigéria','Noruega',
  'Nova Zelândia','Países Baixos','Panamá','Paraguai','Peru','Portugal',
  'RD Congo','Romênia','Sérvia','Senegal','Suécia','Suíça','Tchéquia',
  'Turquia','Uruguai','Venezuela',
].sort()
