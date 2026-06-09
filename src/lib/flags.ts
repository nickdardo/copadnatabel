export const TEAM_ISO: Record<string, string> = {
  // ── Português ─────────────────────────────────────────────
  'Albania':'AL','Alemanha':'DE','Argentina':'AR','Arábia Saudita':'SA',
  'Austrália':'AU','Áustria':'AT','Bélgica':'BE','Bolívia':'BO',
  'Brasil':'BR','Camarões':'CM','Canadá':'CA','Cazaquistão':'KZ',
  'Chile':'CL','Colômbia':'CO','Coreia do Sul':'KR','Costa Rica':'CR',
  'Croácia':'HR','Dinamarca':'DK','Equador':'EC','Eslováquia':'SK',
  'Eslovênia':'SI','Espanha':'ES','Estados Unidos':'US','França':'FR',
  'Geórgia':'GE','Honduras':'HN','Hungria':'HU','Inglaterra':'gb-eng',
  'Irã':'IR','Iraque':'IQ','Israel':'IL','Itália':'IT',
  'Jamaica':'JM','Japão':'JP','Marrocos':'MA','México':'MX',
  'Moçambique':'MZ','Nigéria':'NG','Noruega':'NO','Nova Zelândia':'NZ',
  'Países Baixos':'NL','Panamá':'PA','Paraguai':'PY','Peru':'PE',
  'Portugal':'PT','RD Congo':'CD','Romênia':'RO','Sérvia':'RS',
  'Senegal':'SN','Suécia':'SE','Suíça':'CH','Tchéquia':'CZ',
  'Turquia':'TR','Uruguai':'UY','Venezuela':'VE',
  'Escócia':'gb-sct','País de Gales':'gb-wls','África do Sul':'ZA',
  'Bósnia e Herzegovina':'BA','Haiti':'HT','Costa do Marfim':'CI',
  'Polônia':'PL','Grécia':'GR','Ucrânia':'UA','Catar':'QA',
  'Indonésia':'ID','Trinidad e Tobago':'TT','Gana':'GH',
  'Tunísia':'TN','Argélia':'DZ','Egito':'EG','Finlândia':'FI','Islândia':'IS',
  // ── English (The Odds API) ────────────────────────────────
  'Germany':'DE','Saudi Arabia':'SA','Australia':'AU','Austria':'AT',
  'Belgium':'BE','Bolivia':'BO','Brazil':'BR','Cameroon':'CM',
  'Canada':'CA','Kazakhstan':'KZ','Colombia':'CO',
  'South Korea':'KR','Korea Republic':'KR','Croatia':'HR',
  'Denmark':'DK','Ecuador':'EC','Slovakia':'SK','Slovenia':'SI',
  'Spain':'ES','United States':'US','USA':'US','France':'FR',
  'Georgia':'GE','Hungary':'HU','England':'gb-eng',
  'Iran':'IR','Iraq':'IQ','Italy':'IT','Japan':'JP',
  'Morocco':'MA','Mexico':'MX','Mozambique':'MZ','Nigeria':'NG',
  'Norway':'NO','New Zealand':'NZ','Netherlands':'NL','Panama':'PA',
  'Paraguay':'PY','Romania':'RO','Serbia':'RS','Sweden':'SE',
  'Switzerland':'CH','Czech Republic':'CZ','Czechia':'CZ',
  'Turkey':'TR','Turkiye':'TR','Uruguay':'UY',
  'Wales':'gb-wls','Scotland':'gb-sct','Poland':'PL','Greece':'GR',
  'Ukraine':'UA','Bosnia and Herzegovina':'BA','Bosnia-Herzegovina':'BA',
  'Qatar':'QA','South Africa':'ZA','Indonesia':'ID',
  'Trinidad and Tobago':'TT',"Ivory Coast":'CI',"Cote d'Ivoire":'CI',
  'Ghana':'GH','Tunisia':'TN','Algeria':'DZ','Egypt':'EG',
  'Finland':'FI','Iceland':'IS','Kosovo':'XK','Luxembourg':'LU',
  'El Salvador':'SV',
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
  'SV':'🇸🇻',
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
