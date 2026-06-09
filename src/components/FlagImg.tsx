// FlagImg — uses flagcdn.com PNG with emoji fallback
// ISO codes must be lowercase for flagcdn

const ISO_MAP: Record<string, string> = {
  // ── Exact DB names (from The Odds API translated) ─────────
  'México':'mx','Equador':'ec','Canadá':'ca','África do Sul':'za',
  'Coreia do Sul':'kr','Tchequia':'cz','Tchéquia':'cz',
  'Bosnia & Herzegovina':'ba','Bósnia e Herzegovina':'ba',
  'Bosnia and Herzegovina':'ba','Bosnia-Herzegovina':'ba',
  'Estados Unidos':'us','Paraguai':'py','Qatar':'qa','Catar':'qa',
  'Suíça':'ch','Brasil':'br','Marrocos':'ma','Haiti':'ht',
  'Escócia':'gb-sct','Scotland':'gb-sct','Alemanha':'de',
  'Uruguai':'uy','Espanha':'es','Bélgica':'be','França':'fr',
  'Argentina':'ar','Portugal':'pt','Inglaterra':'gb-eng',
  'England':'gb-eng','Países Baixos':'nl','Itália':'it',
  'Croácia':'hr','Sérvia':'rs','Dinamarca':'dk','Áustria':'at',
  'Turquia':'tr','Geórgia':'ge','Japão':'jp','Austrália':'au',
  'Nigéria':'ng','Camarões':'cm','Arábia Saudita':'sa',
  'Irã':'ir','Iraque':'iq','Israel':'il','Jamaica':'jm',
  'Peru':'pe','Chile':'cl','Colômbia':'co','Venezuela':'ve',
  'Bolívia':'bo','Senegal':'sn','Gana':'gh','Noruega':'no',
  'Suécia':'se','Polônia':'pl','Grécia':'gr','Ucrânia':'ua',
  'Hungria':'hu','Eslováquia':'sk','Eslovênia':'si','Romênia':'ro',
  'Cazaquistão':'kz','Albânia':'al','Albania':'al',
  'Moçambique':'mz','RD Congo':'cd','Nova Zelândia':'nz',
  'Panamá':'pa','Honduras':'hn','Costa Rica':'cr','El Salvador':'sv',
  'Tunísia':'tn','Argélia':'dz','Egito':'eg','Finlândia':'fi',
  'Islândia':'is','Kosovo':'xk','Luxemburgo':'lu','Uzbequistão':'uz',
  'Curaçao':'cw','Cape Verde':'cv','Jordan':'jo','Gana':'gh',
  // ── English names (direct from API if not translated) ──────
  'Mexico':'mx','Ecuador':'ec','Canada':'ca','South Africa':'za',
  'Korea Republic':'kr','South Korea':'kr','Czech Republic':'cz',
  'Czechia':'cz','United States':'us','USA':'us','Paraguay':'py',
  'Qatar':'qa','Switzerland':'ch','Brazil':'br','Morocco':'ma',
  'Germany':'de','Uruguay':'uy','Spain':'es','Belgium':'be',
  'France':'fr','Portugal':'pt','Netherlands':'nl','Italy':'it',
  'Croatia':'hr','Serbia':'rs','Denmark':'dk','Austria':'at',
  'Turkey':'tr','Turkiye':'tr','Georgia':'ge','Japan':'jp',
  'Australia':'au','Nigeria':'ng','Cameroon':'cm',
  'Saudi Arabia':'sa','Iran':'ir','Iraq':'iq','Jamaica':'jm',
  'Chile':'cl','Colombia':'co','Venezuela':'ve','Bolivia':'bo',
  'Senegal':'sn','Ghana':'gh','Norway':'no','Sweden':'se',
  'Poland':'pl','Greece':'gr','Ukraine':'ua','Hungary':'hu',
  'Slovakia':'sk','Slovenia':'si','Romania':'ro',
  'Kazakhstan':'kz','Mozambique':'mz','DR Congo':'cd',
  'New Zealand':'nz','Panama':'pa','Honduras':'hn',
  'Costa Rica':'cr','Tunisia':'tn','Algeria':'dz',
  'Egypt':'eg','Finland':'fi','Iceland':'is',
  "Ivory Coast":'ci',"Cote d'Ivoire":'ci',
  'Trinidad and Tobago':'tt','Indonesia':'id',
  'Uzbekistan':'uz','Curacao':'cw',
  'Wales':'gb-wls','País de Gales':'gb-wls',
  'Albania':'al','Argentina':'ar','Israel':'il','Peru':'pe',
}

const EMOJI_MAP: Record<string, string> = {
  'mx':'🇲🇽','ec':'🇪🇨','ca':'🇨🇦','za':'🇿🇦','kr':'🇰🇷','cz':'🇨🇿',
  'ba':'🇧🇦','us':'🇺🇸','py':'🇵🇾','qa':'🇶🇦','ch':'🇨🇭','br':'🇧🇷',
  'ma':'🇲🇦','ht':'🇭🇹','gb-sct':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','de':'🇩🇪','uy':'🇺🇾',
  'es':'🇪🇸','be':'🇧🇪','fr':'🇫🇷','ar':'🇦🇷','pt':'🇵🇹','gb-eng':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'nl':'🇳🇱','it':'🇮🇹','hr':'🇭🇷','rs':'🇷🇸','dk':'🇩🇰','at':'🇦🇹',
  'tr':'🇹🇷','ge':'🇬🇪','jp':'🇯🇵','au':'🇦🇺','ng':'🇳🇬','cm':'🇨🇲',
  'sa':'🇸🇦','ir':'🇮🇷','iq':'🇮🇶','il':'🇮🇱','jm':'🇯🇲','pe':'🇵🇪',
  'cl':'🇨🇱','co':'🇨🇴','ve':'🇻🇪','bo':'🇧🇴','sn':'🇸🇳','gh':'🇬🇭',
  'no':'🇳🇴','se':'🇸🇪','pl':'🇵🇱','gr':'🇬🇷','ua':'🇺🇦','hu':'🇭🇺',
  'sk':'🇸🇰','si':'🇸🇮','ro':'🇷🇴','kz':'🇰🇿','al':'🇦🇱','mz':'🇲🇿',
  'cd':'🇨🇩','nz':'🇳🇿','pa':'🇵🇦','hn':'🇭🇳','cr':'🇨🇷','sv':'🇸🇻',
  'tn':'🇹🇳','dz':'🇩🇿','eg':'🇪🇬','fi':'🇫🇮','is':'🇮🇸','xk':'🇽🇰',
  'lu':'🇱🇺','uz':'🇺🇿','cw':'🇨🇼','cv':'🇨🇻','jo':'🇯🇴','ci':'🇨🇮',
  'tt':'🇹🇹','id':'🇮🇩','gb-wls':'🏴󠁧󠁢󠁷󠁬󠁳󠁿',
}

import { useState } from 'react'

type Props = { team: string; dbFlag?: string; size?: number; className?: string }

export default function FlagImg({ team, size = 40, className = '' }: Props) {
  const [imgError, setImgError] = useState(false)

  // Find ISO
  const lower = team.toLowerCase()
  let iso = ISO_MAP[team]
  if (!iso) {
    const found = Object.entries(ISO_MAP).find(([k]) => k.toLowerCase() === lower)
    iso = found?.[1]
  }
  if (!iso) {
    const partial = Object.entries(ISO_MAP).find(([k]) =>
      lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
    )
    iso = partial?.[1]
  }

  const emoji = iso ? (EMOJI_MAP[iso] || '🏳️') : '🏳️'

  // Always use emoji — reliable on all platforms
  return (
    <span
      className={`leading-none select-none block text-center ${className}`}
      style={{ fontSize: size, lineHeight: 1 }}
      role="img"
      aria-label={team}
    >
      {emoji}
    </span>
  )
}
