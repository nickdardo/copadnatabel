// FlagImg — uses flag-icons CSS library (cdnjs CDN, very reliable)
// Fallback: flagcdn.com PNG
// All 48 Copa 2026 teams mapped

const ISO_MAP: Record<string, string> = {
  'México': 'mx', 'Equador': 'ec', 'Canadá': 'ca', 'África do Sul': 'za',
  'Coreia do Sul': 'kr', 'Tchéquia': 'cz', 'Tchequia': 'cz', 'Bosnia & Herzegovina': 'ba',
  'Bósnia e Herzegovina': 'ba', 'Estados Unidos': 'us', 'Paraguai': 'py', 'Qatar': 'qa',
  'Catar': 'qa', 'Suíça': 'ch', 'Brasil': 'br', 'Marrocos': 'ma',
  'Haiti': 'ht', 'Escócia': 'gb-sct', 'Alemanha': 'de', 'Uruguai': 'uy',
  'Espanha': 'es', 'Bélgica': 'be', 'França': 'fr', 'Argentina': 'ar',
  'Portugal': 'pt', 'Inglaterra': 'gb-eng', 'Países Baixos': 'nl', 'Itália': 'it',
  'Croácia': 'hr', 'Sérvia': 'rs', 'Dinamarca': 'dk', 'Áustria': 'at',
  'Turquia': 'tr', 'Geórgia': 'ge', 'Japão': 'jp', 'Austrália': 'au',
  'Nigéria': 'ng', 'Camarões': 'cm', 'Arábia Saudita': 'sa', 'Irã': 'ir',
  'Iraque': 'iq', 'Israel': 'il', 'Jamaica': 'jm', 'Peru': 'pe',
  'Chile': 'cl', 'Colômbia': 'co', 'Venezuela': 've', 'Bolívia': 'bo',
  'Senegal': 'sn', 'Gana': 'gh', 'Noruega': 'no', 'Suécia': 'se',
  'Polônia': 'pl', 'Grécia': 'gr', 'Ucrânia': 'ua', 'Hungria': 'hu',
  'Eslováquia': 'sk', 'Eslovênia': 'si', 'Romênia': 'ro', 'Cazaquistão': 'kz',
  'Albânia': 'al', 'Albania': 'al', 'Moçambique': 'mz', 'RD Congo': 'cd',
  'Nova Zelândia': 'nz', 'Panamá': 'pa', 'Honduras': 'hn', 'Costa Rica': 'cr',
  'El Salvador': 'sv', 'Tunísia': 'tn', 'Argélia': 'dz', 'Egito': 'eg',
  'Finlândia': 'fi', 'Islândia': 'is', 'Kosovo': 'xk', 'Luxemburgo': 'lu',
  'Uzbequistão': 'uz', 'Uzbekistan': 'uz', 'Curaçao': 'cw', 'Cape Verde': 'cv',
  'Jordan': 'jo', 'Costa do Marfim': 'ci', 'País de Gales': 'gb-wls', 'Mexico': 'mx',
  'Ecuador': 'ec', 'Canada': 'ca', 'South Africa': 'za', 'Korea Republic': 'kr',
  'South Korea': 'kr', 'Czech Republic': 'cz', 'Czechia': 'cz', 'Bosnia and Herzegovina': 'ba',
  'Bosnia-Herzegovina': 'ba', 'United States': 'us', 'USA': 'us', 'Switzerland': 'ch',
  'Brazil': 'br', 'Morocco': 'ma', 'Germany': 'de', 'Uruguay': 'uy',
  'Spain': 'es', 'Belgium': 'be', 'France': 'fr', 'Netherlands': 'nl',
  'Italy': 'it', 'Croatia': 'hr', 'Serbia': 'rs', 'Denmark': 'dk',
  'Austria': 'at', 'Turkey': 'tr', 'Turkiye': 'tr', 'Georgia': 'ge',
  'Japan': 'jp', 'Australia': 'au', 'Nigeria': 'ng', 'Cameroon': 'cm',
  'Saudi Arabia': 'sa', 'Iran': 'ir', 'Iraq': 'iq', 'England': 'gb-eng',
  'Wales': 'gb-wls', 'Scotland': 'gb-sct', 'Colombia': 'co', 'Bolivia': 'bo',
  'Ghana': 'gh', 'Norway': 'no', 'Sweden': 'se', 'Poland': 'pl',
  'Greece': 'gr', 'Ukraine': 'ua', 'Hungary': 'hu', 'Slovakia': 'sk',
  'Slovenia': 'si', 'Romania': 'ro', 'Kazakhstan': 'kz', 'Mozambique': 'mz',
  'DR Congo': 'cd', 'New Zealand': 'nz', 'Panama': 'pa', 'Tunisia': 'tn',
  'Algeria': 'dz', 'Egypt': 'eg', 'Finland': 'fi', 'Iceland': 'is',
  'Paraguay': 'py', 'Ivory Coast': 'ci', 'Trinidad and Tobago': 'tt', 'Indonesia': 'id',
  'Curacao': 'cw',
}

function getIso(team: string): string | null {
  if (ISO_MAP[team]) return ISO_MAP[team]
  const lower = team.toLowerCase()
  const found = Object.entries(ISO_MAP).find(([k]) => k.toLowerCase() === lower)
  if (found) return found[1]
  const partial = Object.entries(ISO_MAP).find(([k]) =>
    lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  )
  return partial ? partial[1] : null
}

type Props = { team: string; dbFlag?: string; size?: number; className?: string }

export default function FlagImg({ team, size = 44, className = '' }: Props) {
  const iso = getIso(team)
  const w = Math.round(size)
  const h = Math.round(size * 0.67)

  if (!iso) {
    return (
      <div style={{ width: w, height: h }}
        className={`bg-gray-100 rounded flex items-center justify-center text-gray-400 text-[10px] font-bold ${className}`}>
        {team.slice(0, 3).toUpperCase()}
      </div>
    )
  }

  // Use flag-icons CSS via CDN — renders as <span> with background SVG
  // CDN: cdnjs.cloudflare.com (very reliable, no CORS issues)
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/6.6.6/css/flag-icons.min.css"
      />
      <span
        className={`fi fi-${iso} fis ${className}`}
        style={{
          width: w,
          height: h,
          borderRadius: 4,
          display: 'inline-block',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}
        title={team}
        aria-label={team}
      />
    </>
  )
}
