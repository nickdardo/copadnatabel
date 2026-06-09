import { getFlagProps } from '@/lib/flags'
import { useState } from 'react'

type Props = {
  team: string
  dbFlag?: string
  size?: number       // px
  className?: string
}

export default function FlagImg({ team, dbFlag, size = 40, className = '' }: Props) {
  const [useFallback, setUseFallback] = useState(false)
  const props = getFlagProps(team, dbFlag)

  if (props.type === 'png' && !useFallback) {
    return (
      <img
        src={props.src}
        alt={props.alt}
        width={size}
        height={Math.round(size * 0.67)}
        className={`object-cover rounded-sm shadow-sm ${className}`}
        onError={() => setUseFallback(true)}
        style={{ width: size, height: Math.round(size * 0.67) }}
      />
    )
  }

  // Emoji fallback
  const emoji = props.type === 'png' ? (props.emoji || '🏳️') : props.value
  return (
    <span
      className={`leading-none select-none ${className}`}
      style={{ fontSize: size, lineHeight: 1 }}
      aria-label={team}
    >
      {emoji}
    </span>
  )
}
