import { useState } from 'react'

// ISO 3166-1 alpha-2 codes — all 48 Copa 2026 teams
const ISO: Record<string, string> = {
  'México':'mx','Equador':'ec','Canadá':'ca','África do Sul':'za',
  'Coreia do Sul':'kr','Tchéquia':'cz','Tchequia':'cz',
  'Bosnia & Herzegovina':'ba','Bósnia e Herzegovina':'ba',
  'Bosnia and Herzegovina':'ba','Bosnia-Herzegovina':'ba',
  'Estados Unidos':'us','Paraguai':'py','Qatar':'qa','Catar':'qa',
  'Suíça':'ch','Brasil':'br','Marrocos':'ma','Haiti':'ht',
  'Escócia':'gb-sct','Alemanha':'de','Uruguai':'uy','Espanha':'es',
  'Bélgica':'be','França':'fr','Argentina':'ar','Portugal':'pt',
  'Inglaterra':'gb-eng','Países Baixos':'nl','Itália':'it',
  'Croácia':'hr','Sérvia':'rs','Dinamarca':'dk','Áustria':'at',
  'Turquia':'tr','Geórgia':'ge','Japão':'jp','Austrália':'au',
  'Nigéria':'ng','Camarões':'cm','Arábia Saudita':'sa','Irã':'ir',
  'Iraque':'iq','Israel':'il','Jamaica':'jm','Peru':'pe','Chile':'cl',
  'Colômbia':'co','Venezuela':'ve','Bolívia':'bo','Senegal':'sn',
  'Gana':'gh','Noruega':'no','Suécia':'se','Polônia':'pl','Grécia':'gr',
  'Ucrânia':'ua','Hungria':'hu','Eslováquia':'sk','Eslovênia':'si',
  'Romênia':'ro','Cazaquistão':'kz','Albânia':'al','Moçambique':'mz',
  'RD Congo':'cd','Nova Zelândia':'nz','Panamá':'pa','Honduras':'hn',
  'Costa Rica':'cr','El Salvador':'sv','Tunísia':'tn','Argélia':'dz',
  'Egito':'eg','Finlândia':'fi','Islândia':'is','Kosovo':'xk',
  'Luxemburgo':'lu','Uzbequistão':'uz','Uzbekistan':'uz',
  'Curaçao':'cw','Cape Verde':'cv','Jordan':'jo',
  'Costa do Marfim':'ci','País de Gales':'gb-wls',
  'Mexico':'mx','Ecuador':'ec','Canada':'ca','South Africa':'za',
  'Korea Republic':'kr','South Korea':'kr','Czech Republic':'cz',
  'Czechia':'cz','United States':'us','USA':'us','Switzerland':'ch',
  'Brazil':'br','Morocco':'ma','Germany':'de','Uruguay':'uy',
  'Spain':'es','Belgium':'be','France':'fr','Netherlands':'nl',
  'Italy':'it','Croatia':'hr','Serbia':'rs','Denmark':'dk',
  'Austria':'at','Turkey':'tr','Turkiye':'tr','Georgia':'ge',
  'Japan':'jp','Australia':'au','Nigeria':'ng','Cameroon':'cm',
  'Saudi Arabia':'sa','Iran':'ir','Iraq':'iq','England':'gb-eng',
  'Wales':'gb-wls','Scotland':'gb-sct','Colombia':'co','Bolivia':'bo',
  'Ghana':'gh','Norway':'no','Sweden':'se','Poland':'pl','Greece':'gr',
  'Ukraine':'ua','Hungary':'hu','Slovakia':'sk','Slovenia':'si',
  'Romania':'ro','Kazakhstan':'kz','Mozambique':'mz','DR Congo':'cd',
  'New Zealand':'nz','Panama':'pa','Tunisia':'tn','Algeria':'dz',
  'Egypt':'eg','Finland':'fi','Iceland':'is','Paraguay':'py',
  'Ivory Coast':'ci','Trinidad and Tobago':'tt','Indonesia':'id',
  'Curacao':'cw','Albania':'al',
}

function getIso(team: string): string | null {
  if (ISO[team]) return ISO[team]
  const lower = team.toLowerCase()
  const e1 = Object.entries(ISO).find(([k]) => k.toLowerCase() === lower)
  if (e1) return e1[1]
  const e2 = Object.entries(ISO).find(([k]) =>
    lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  )
  return e2 ? e2[1] : null
}

type Props = { team: string; dbFlag?: string; size?: number; className?: string }

export default function FlagImg({ team, size = 44, className = '' }: Props) {
  const [error, setError] = useState(false)
  const iso = getIso(team)
  const w = size
  const h = Math.round(size * 0.67)

  if (!iso || error) {
    return (
      <div style={{ width: w, height: h }}
        className={`rounded bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-gray-400 font-bold" style={{ fontSize: size * 0.25 }}>
          {team.slice(0, 3).toUpperCase()}
        </span>
      </div>
    )
  }

  return (
    <img
      src={`https://flagcdn.com/w80/${iso}.png`}
      srcSet={`https://flagcdn.com/w40/${iso}.png 1x, https://flagcdn.com/w80/${iso}.png 2x`}
      alt={team}
      width={w}
      height={h}
      loading="lazy"
      onError={() => setError(true)}
      className={`rounded-sm object-cover flex-shrink-0 ${className}`}
      style={{ width: w, height: h, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
    />
  )
}
