import { TEAM_ISO } from '@/lib/flags'

// Emoji flag map — works everywhere, no external dependencies
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

type Props = { team: string; dbFlag?: string; size?: number; className?: string }

export default function FlagImg({ team, dbFlag, size = 44, className = '' }: Props) {
  // Resolve ISO
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

  const emoji = iso ? (EMOJI[iso] || '🏳️') : '🏳️'

  return (
    <span
      className={`leading-none select-none block text-center ${className}`}
      style={{ fontSize: size, lineHeight: 1 }}
      aria-label={team}
    >
      {emoji}
    </span>
  )
}
