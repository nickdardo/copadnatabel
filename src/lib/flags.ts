export const TEAM_ISO: Record<string, string> = {
  'África do Sul':'ZA','Alemanha':'DE','Arábia Saudita':'SA','Argélia':'DZ',
  'Argentina':'AR','Austrália':'AU','Áustria':'AT','Bélgica':'BE',
  'Brasil':'BR','Camarões':'CM','Canadá':'CA','Colômbia':'CO',
  'Coreia do Sul':'KR','Costa Rica':'CR','Croácia':'HR','Dinamarca':'DK',
  'Egito':'EG','Emirados Árabes':'AE','Equador':'EC','Eslovênia':'SI',
  'Espanha':'ES','Estados Unidos':'US','França':'FR','Guatemala':'GT',
  'Honduras':'HN','Hungria':'HU','Indonésia':'ID','Inglaterra':'gb-eng',
  'Irã':'IR','Iraque':'IQ','Japão':'JP','Marrocos':'MA',
  'México':'MX','Nigéria':'NG','Nova Zelândia':'NZ','Países Baixos':'NL',
  'Panamá':'PA','Portugal':'PT','RD Congo':'CD','Romênia':'RO',
  'Senegal':'SN','Sérvia':'RS','Suíça':'CH','Tunísia':'TN',
  'Turquia':'TR','Uruguai':'UY','Uzbequistão':'UZ','Venezuela':'VE',
  'Algeria':'DZ','Australia':'AU','Austria':'AT','Belgium':'BE',
  'Brazil':'BR','Cameroon':'CM','Canada':'CA','Colombia':'CO',
  'Congo DR':'CD','Croatia':'HR','Czechia':'CZ','Denmark':'DK',
  'Ecuador':'EC','Egypt':'EG','England':'gb-eng','France':'FR',
  'Germany':'DE','Hungary':'HU','Indonesia':'ID','Iran':'IR',
  'Iraq':'IQ','Japan':'JP','Mexico':'MX','Morocco':'MA',
  'Netherlands':'NL','New Zealand':'NZ','Nigeria':'NG','Panama':'PA',
  'Romania':'RO','Saudi Arabia':'SA','Serbia':'RS','Slovenia':'SI',
  'South Africa':'ZA','South Korea':'KR','Spain':'ES','Switzerland':'CH',
  'Tunisia':'TN','Turkey':'TR','Ukraine':'UA','United Arab Emirates':'AE',
  'United States':'US','Uruguay':'UY','Uzbekistan':'UZ',
}

const EMOJI: Record<string, string> = {
  'DE':'🇩🇪','AR':'🇦🇷','SA':'🇸🇦','AU':'🇦🇺','AT':'🇦🇹','BE':'🇧🇪',
  'BR':'🇧🇷','CM':'🇨🇲','CA':'🇨🇦','CO':'🇨🇴','KR':'🇰🇷','CR':'🇨🇷',
  'HR':'🇭🇷','DK':'🇩🇰','EC':'🇪🇨','SI':'🇸🇮','ES':'🇪🇸','US':'🇺🇸',
  'FR':'🇫🇷','HN':'🇭🇳','HU':'🇭🇺','IR':'🇮🇷','IQ':'🇮🇶','JP':'🇯🇵',
  'MA':'🇲🇦','MX':'🇲🇽','NG':'🇳🇬','NZ':'🇳🇿','NL':'🇳🇱','PA':'🇵🇦',
  'PT':'🇵🇹','CD':'🇨🇩','RO':'🇷🇴','RS':'🇷🇸','SN':'🇸🇳','CH':'🇨🇭',
  'CZ':'🇨🇿','TR':'🇹🇷','UY':'🇺🇾','VE':'🇻🇪','ZA':'🇿🇦','ID':'🇮🇩',
  'TN':'🇹🇳','DZ':'🇩🇿','EG':'🇪🇬','AE':'🇦🇪','GT':'🇬🇹','UA':'🇺🇦',
  'UZ':'🇺🇿','PL':'🇵🇱','IT':'🇮🇹',
  'gb-eng':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
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

export const TEAMS_SELECT = [
  'África do Sul','Alemanha','Arábia Saudita','Argélia','Argentina',
  'Austrália','Áustria','Bélgica','Brasil','Camarões','Canadá',
  'Colômbia','Coreia do Sul','Costa Rica','Croácia','Dinamarca',
  'Egito','Emirados Árabes','Equador','Eslovênia','Espanha',
  'Estados Unidos','França','Guatemala','Honduras','Hungria',
  'Indonésia','Inglaterra','Irã','Iraque','Japão','Marrocos',
  'México','Nigéria','Nova Zelândia','Países Baixos','Panamá',
  'Portugal','RD Congo','Romênia','Senegal','Sérvia','Suíça',
  'Tunísia','Turquia','Uruguai','Uzbequistão','Venezuela',
].sort()
