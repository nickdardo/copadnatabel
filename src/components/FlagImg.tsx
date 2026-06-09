import { useState } from 'react'
import { TEAM_ISO } from '@/lib/flags'

type Props = {
  team:     string
  dbFlag?:  string
  size?:    number
  className?: string
}

// flagcdn.com — CDN pública gratuita, sem rate limit para uso normal
// URL: https://flagcdn.com/w80/{iso_lowercase}.png
// Ex: https://flagcdn.com/w80/br.png

function resolveIso(team: string): string | null {
  if (TEAM_ISO[team]) return TEAM_ISO[team].toLowerCase()
  const lower = team.toLowerCase()
  const found = Object.entries(TEAM_ISO).find(([k]) => k.toLowerCase() === lower)
  if (found) return found[1].toLowerCase()
  const partial = Object.entries(TEAM_ISO).find(([k]) =>
    lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  )
  return partial ? partial[1].toLowerCase() : null
}

export default function FlagImg({ team, dbFlag, size = 48, className = '' }: Props) {
  const [error, setError] = useState(false)

  // If DB has a real emoji flag (from manual inserts) and no PNG yet
  const iso = resolveIso(team)

  if (!iso || error) {
    // Fallback: emoji flag from dbFlag or nothing
    return (
      <span
        className={`leading-none select-none ${className}`}
        style={{ fontSize: Math.round(size * 0.9), lineHeight: 1 }}
        aria-label={team}
      >
        {dbFlag && dbFlag !== '🏳️' ? dbFlag : '🏳️'}
      </span>
    )
  }

  // flagcdn.com — tamanho disponível: w20, w40, w80, w160, w320, w640, w1280, w2560
  const cdnSize = size <= 24 ? 'w20' : size <= 48 ? 'w40' : size <= 80 ? 'w80' : 'w160'
  const src = `https://flagcdn.com/${cdnSize}/${iso}.png`
  const src2x = `https://flagcdn.com/${cdnSize === 'w40' ? 'w80' : 'w160'}/${iso}.png`

  return (
    <img
      src={src}
      srcSet={`${src} 1x, ${src2x} 2x`}
      alt={team}
      width={size}
      height={Math.round(size * 0.67)}
      className={`object-cover rounded-sm shadow-sm ${className}`}
      style={{ width: size, height: Math.round(size * 0.67), display: 'inline-block' }}
      onError={() => setError(true)}
      loading="lazy"
    />
  )
}
