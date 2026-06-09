import { useState } from 'react'

const ISO: Record<string, string> = {
  'México':'mx',
  'Coreia do Sul':'kr',
  'Bosnia & Herzegovina':'ba',
  'Bosnia and Herzegovina':'ba',
  'Estados Unidos':'us',
  'Suíça':'ch',
  'Escócia':'gb-sct',
  'Bélgica':'be',
  'Inglaterra':'gb-eng',
  'Croácia':'hr',
  'Turquia':'tr',
  'Nigéria':'ng',
  'Iraque':'iq',
  'Colômbia':'co',
  'Gana':'gh',
  'Ucrânia':'ua',
  'Romênia':'ro',
  'Moçambique':'mz',
  'Honduras':'hn',
  'Argélia':'dz',
  'Kosovo':'xk',
  'Curaçao':'cw',
  'País de Gales':'gb-wls',
  'Mexico':'mx',
  'Korea Republic':'kr',
  'United States':'us',
  'Morocco':'ma',
  'France':'fr',
  'Denmark':'dk',
  'Japan':'jp',
  'Saudi Arabia':'sa',
  'Wales':'gb-wls',
  'Ghana':'gh',
  'Ukraine':'ua',
  'Romania':'ro',
  'New Zealand':'nz',
  'Egypt':'eg',
  'Ivory Coast':'ci',
  'Curacao':'cw',
  'Israel':'il',
  'Portugal':'pt',
}

type Props = { team: string; dbFlag?: string; size?: number; className?: string }

export default function FlagImg({ team, size = 44, className = '' }: Props) {
  const [error, setError] = useState(false)

  // Resolve ISO code
  const lower = team.toLowerCase()
  let iso = ISO[team]
  if (!iso) {
    const found = Object.entries(ISO).find(([k]) => k.toLowerCase() === lower)
    if (found) iso = found[1]
  }
  if (!iso) {
    const partial = Object.entries(ISO).find(([k]) =>
      lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
    )
    if (partial) iso = partial[1]
  }

  if (!iso || error) {
    // Text fallback showing team abbreviation
    const abbr = team.slice(0, 3).toUpperCase()
    return (
      <span className={`flex items-center justify-center font-bold text-gray-400 ${className}`}
        style={{ width: size, height: Math.round(size * 0.67), fontSize: size * 0.28 }}>
        {abbr}
      </span>
    )
  }

  // flagcdn.com PNG - reliable CDN for country flags
  const w = size <= 32 ? 40 : size <= 48 ? 40 : 80
  const src = `https://flagcdn.com/w${w}/${iso}.png`

  return (
    <img
      src={src}
      alt={team}
      width={size}
      height={Math.round(size * 0.67)}
      onError={() => setError(true)}
      loading="lazy"
      className={`object-cover rounded-sm shadow-sm flex-shrink-0 ${className}`}
      style={{ width: size, height: Math.round(size * 0.67) }}
    />
  )
}
