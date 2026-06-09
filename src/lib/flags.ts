// Mapa único PT+EN sem duplicatas — usado em todo o projeto
const FLAG_MAP: Record<string, string> = {
  // ── Português ─────────────────────────────────────────────────
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
  // ── Inglês (The Odds API) — sem duplicar chaves já em PT ──────
  'Germany':'🇩🇪','Saudi Arabia':'🇸🇦','Australia':'🇦🇺','Austria':'🇦🇹',
  'Belgium':'🇧🇪','Bolivia':'🇧🇴','Brazil':'🇧🇷','Cameroon':'🇨🇲',
  'Canada':'🇨🇦','Kazakhstan':'🇰🇿','Colombia':'🇨🇴',
  'South Korea':'🇰🇷','Korea Republic':'🇰🇷','Croatia':'🇭🇷',
  'Denmark':'🇩🇰','Ecuador':'🇪🇨','Slovakia':'🇸🇰','Slovenia':'🇸🇮',
  'Spain':'🇪🇸','United States':'🇺🇸','USA':'🇺🇸','France':'🇫🇷',
  'Georgia':'🇬🇪','Hungary':'🇭🇺','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Iran':'🇮🇷','Iraq':'🇮🇶','Italy':'🇮🇹','Japan':'🇯🇵',
  'Morocco':'🇲🇦','Mexico':'🇲🇽','Mozambique':'🇲🇿','Nigeria':'🇳🇬',
  'Norway':'🇳🇴','New Zealand':'🇳🇿','Netherlands':'🇳🇱','Panama':'🇵🇦',
  'Paraguay':'🇵🇾','Romania':'🇷🇴','Serbia':'🇷🇸','Sweden':'🇸🇪',
  'Switzerland':'🇨🇭','Czech Republic':'🇨🇿','Czechia':'🇨🇿',
  'Turkey':'🇹🇷','Turkiye':'🇹🇷','Uruguay':'🇺🇾',
  'Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Poland':'🇵🇱','Greece':'🇬🇷',
  'Ukraine':'🇺🇦','Bosnia and Herzegovina':'🇧🇦','Qatar':'🇶🇦',
  'Indonesia':'🇮🇩','South Africa':'🇿🇦','Trinidad and Tobago':'🇹🇹',
  'El Salvador':'🇸🇻','Cuba':'🇨🇺','Guatemala':'🇬🇹','Haiti':'🇭🇹',
  "Ivory Coast":'🇨🇮',"Cote d'Ivoire":'🇨🇮','Ghana':'🇬🇭',
  'Tunisia':'🇹🇳','Algeria':'🇩🇿','Egypt':'🇪🇬','Finland':'🇫🇮',
  'Iceland':'🇮🇸','Kosovo':'🇽🇰','Luxembourg':'🇱🇺',
}

export function getFlag(team: string, dbFlag?: string): string {
  if (dbFlag && dbFlag !== '🏳️' && dbFlag.length > 0) return dbFlag
  if (FLAG_MAP[team]) return FLAG_MAP[team]
  const lower = team.toLowerCase()
  const exact = Object.entries(FLAG_MAP).find(([k]) => k.toLowerCase() === lower)
  if (exact) return exact[1]
  const partial = Object.entries(FLAG_MAP).find(([k]) =>
    lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  )
  return partial ? partial[1] : '🏳️'
}

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
