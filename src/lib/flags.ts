export const TEAM_ISO: Record<string, string> = {
  // Português
  'África do Sul':'ZA',
  'Alemanha':'DE',
  'Arábia Saudita':'SA',
  'Argélia':'DZ',
  'Argentina':'AR',
  'Austrália':'AU',
  'Áustria':'AT',
  'Bélgica':'BE',
  'Brasil':'BR',
  'Camarões':'CM',
  'Canadá':'CA',
  'Colômbia':'CO',
  'Coreia do Sul':'KR',
  'Costa Rica':'CR',
  'Croácia':'HR',
  'Dinamarca':'DK',
  'Egito':'EG',
  'Emirados Árabes':'AE',
  'Equador':'EC',
  'Eslovênia':'SI',
  'Espanha':'ES',
  'Estados Unidos':'US',
  'França':'FR',
  'Guatemala':'GT',
  'Honduras':'HN',
  'Hungria':'HU',
  'Indonésia':'ID',
  'Inglaterra':'gb-eng',
  'Irã':'IR',
  'Iraque':'IQ',
  'Japão':'JP',
  'Marrocos':'MA',
  'México':'MX',
  'Nigéria':'NG',
  'Nova Zelândia':'NZ',
  'Países Baixos':'NL',
  'Panamá':'PA',
  'Portugal':'PT',
  'RD Congo':'CD',
  'Romênia':'RO',
  'Senegal':'SN',
  'Sérvia':'RS',
  'Suíça':'CH',
  'Tunísia':'TN',
  'Turquia':'TR',
  'Uruguai':'UY',
  'Uzbequistão':'UZ',
  'Venezuela':'VE',
  // Inglês (vindo da API)
  'Germany':'DE',
  'Austria':'AT',
  'Colombia':'CO',
  'Egypt':'EG',
  'United States':'US',
  'England':'gb-eng',
  'Morocco':'MA',
  'Netherlands':'NL',
  'Congo DR':'CD',
  'Czechia':'CZ',
  'Uruguay':'UY',
  'Ukraine':'UA',
  'Denmark':'DK',
  'Hungary':'HU',
  'Saudi Arabia':'SA',
  'South Korea':'KR',
  'South Africa':'ZA',
  'Algeria':'DZ',
  'Nigeria':'NG',
  'Tunisia':'TN',
  'Cameroon':'CM',
  'Australia':'AU',
  'Japan':'JP',
  'Iran':'IR',
  'Iraq':'IQ',
  'New Zealand':'NZ',
  'Indonesia':'ID',
  'Uzbekistan':'UZ',
  'United Arab Emirates':'AE',
  'Ecuador':'EC',
  'Croatia':'HR',
  'Serbia':'RS',
  'Switzerland':'CH',
  'Romania':'RO',
  'Slovenia':'SI',
  'Canada':'CA',
  'Mexico':'MX',
  'Panama':'PA',
  'France':'FR',
  'Spain':'ES',
  'Belgium':'BE',
  'Brazil':'BR',
  'Turkey':'TR',
}

const EMOJI: Record<string, string> = {
  'AL':'🇦🇱','DE':'🇩🇪','AR':'🇦🇷','SA':'🇸🇦','AU':'🇦🇺','AT':'🇦🇹',
  'BE':'🇧🇪','BO':'🇧🇴','BR':'🇧🇷','CM':'🇨🇲','CA':'🇨🇦','KZ':'🇰🇿',
  'CL':'🇨🇱','CO':'🇨🇴','KR':'🇰🇷','CR':'🇨🇷','HR':'🇭🇷','DK':'🇩🇰',
  'EC':'🇪🇨','SK':'🇸🇰','SI':'🇸🇮','ES':'🇪🇸','US':'🇺🇸','FR':'🇫🇷',
  'GE':'🇬🇪','HN':'🇭🇳','HU':'🇭🇺','IR':'🇮🇷','IQ':'🇮🇶','IL':'🇮🇱',
  'IT':'🇮🇹','JM':'🇯🇲','JP':'🇯🇵','MA':'🇲🇦','MX':'🇲🇽','MZ':'🇲🇿',
  'NG':'🇳🇬','NO':'🇳🇴','NZ':'🇳🇿','NL':'🇳🇱','PA':'🇵🇦','PY':'🇵🇾',
  'PE':'🇵🇪','PT':'🇵🇹','CD':'🇨🇩','RO':'🇷🇴','RS':'🇷🇸','SN':'🇸🇳',
  'SE':'🇸🇪','CH':'🇨🇭','CZ':'🇨🇿','TR':'🇹🇷','UY':'🇺🇾','VE':'🇻🇪',
  'PL':'🇵🇱','GR':'🇬🇷','UA':'🇺🇦','BA':'🇧🇦','QA':'🇶🇦','HT':'🇭🇹',
  'ZA':'🇿🇦','ID':'🇮🇩','TT':'🇹🇹','CI':'🇨🇮','GH':'🇬🇭','TN':'🇹🇳',
  'DZ':'🇩🇿','EG':'🇪🇬','FI':'🇫🇮','IS':'🇮🇸','XK':'🇽🇰','LU':'🇱🇺',
  'SV':'🇸🇻','CV':'🇨🇻','CW':'🇨🇼','JO':'🇯🇴','UZ':'🇺🇿','IE':'🇮🇪',
  'gb-eng':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','gb-sct':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','gb-wls':'🏴󠁧󠁢󠁷󠁬󠁳󠁿',
}

export function getFlagProps(team: string, dbFlag?: string) {
  if (dbFlag && dbFlag !== '🏳️' && !dbFlag.startsWith('🏳')) {
    return { type: 'emoji' as const, value: dbFlag }
  }
  const lower = team.toLowerCase()
  let iso = TEAM_ISO[team]
  if (!iso) {
    const found = Object.entries(TEAM_ISO).find(([k]) => k.toLowerCase() === lower)
    if (found) iso = found[1]
  }
  if (!iso) {
    const partial = Object.entries(TEAM_ISO).find(([k]) =>
      lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
    )
    if (partial) iso = partial[1]
  }
  if (iso) {
    return { type: 'png' as const, iso, src: `/flags/${iso}.png`, alt: team, emoji: EMOJI[iso] || '🏳️' }
  }
  return { type: 'emoji' as const, value: '🏳️' }
}

export function getFlag(team: string, dbFlag?: string): string {
  const p = getFlagProps(team, dbFlag)
  if (p.type === 'emoji') return p.value
  return p.emoji || '🏳️'
}

// 48 seleções oficialmente classificadas para a Copa do Mundo 2026
export const TEAMS_SELECT = [
  // CONMEBOL (6)
  'Argentina','Brasil','Colômbia','Equador','Uruguai','Venezuela',
  // UEFA (16)
  'Alemanha','Áustria','Bélgica','Croácia','Dinamarca','Espanha',
  'França','Hungria','Inglaterra','Países Baixos','Portugal',
  'Romênia','Sérvia','Suíça','Turquia','Eslovênia',
  // CONCACAF (6)
  'Canadá','Costa Rica','Estados Unidos','Honduras','México','Panamá',
  // AFC (8)
  'Arábia Saudita','Austrália','Coreia do Sul','Emirados Árabes','Irã',
  'Iraque','Japão','Uzbequistão',
  // CAF (9)
  'África do Sul','Argélia','Camarões','Egito','Marrocos',
  'Nigéria','RD Congo','Senegal','Tunísia',
  // OFC (1)
  'Nova Zelândia',
  // Repescagem (2 vagas restantes — provisório)
  'Indonésia','Guatemala',
].sort()
