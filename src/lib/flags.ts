export const TEAM_ISO: Record<string, string> = {
  'África do Sul':'ZA',
  'Austrália':'AU',
  'Brasil':'BR',
  'Coreia do Sul':'KR',
  'Egito':'EG',
  'Estados Unidos':'US',
  'Irã':'IR',
  'México':'MX',
  'Panamá':'PA',
  'Tchéquia':'CZ',
  'Uzbekistan':'UZ',
  'Albania':'AL',
  'Bósnia e Herzegovina':'BA',
  'Camarões':'CM',
  'Catar':'QA',
  'Eslováquia':'SK',
  'Grécia':'GR',
  'Indonésia':'ID',
  'Itália':'IT',
  'Luxemburgo':'LU',
  'Peru':'PE',
  'Senegal':'SN',
  'Uzbequistão':'UZ',
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
  'Trinidad and Tobago':'TT',
  'Kosovo':'XK',
  'Denmark':'DK',
  'Hungary':'HU',
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
