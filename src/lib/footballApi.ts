// Integração com API-Football (api-football.com / api-sports.io)
// Usado para o popup de estatísticas na aba "Encerrados" de Palpites.
//
// IMPORTANTE: este módulo só deve ser chamado a partir de rotas /api/* (server-side),
// nunca diretamente do client, pois usa a chave secreta FOOTBALL_API_KEY.

const FOOTBALL_API_BASE = 'https://v3.football.api-sports.io'

// PT (nome usado no nosso banco) → EN (nome que a API-Football espera no parâmetro `search`)
// A Copa do Mundo na API-Football usa os nomes oficiais de seleção em inglês.
const PT_TO_EN: Record<string, string> = {
  'África do Sul': 'South Africa',
  'Alemanha': 'Germany',
  'Arábia Saudita': 'Saudi Arabia',
  'Argélia': 'Algeria',
  'Argentina': 'Argentina',
  'Austrália': 'Australia',
  'Áustria': 'Austria',
  'Bélgica': 'Belgium',
  'Brasil': 'Brazil',
  'Camarões': 'Cameroon',
  'Canadá': 'Canada',
  'Colômbia': 'Colombia',
  'Coreia do Sul': 'South Korea',
  'Costa Rica': 'Costa Rica',
  'Croácia': 'Croatia',
  'Dinamarca': 'Denmark',
  'Egito': 'Egypt',
  'Emirados Árabes': 'United Arab Emirates',
  'Equador': 'Ecuador',
  'Eslovênia': 'Slovenia',
  'Espanha': 'Spain',
  'Estados Unidos': 'USA',
  'França': 'France',
  'Guatemala': 'Guatemala',
  'Honduras': 'Honduras',
  'Hungria': 'Hungary',
  'Indonésia': 'Indonesia',
  'Inglaterra': 'England',
  'Irã': 'Iran',
  'Iraque': 'Iraq',
  'Japão': 'Japan',
  'Marrocos': 'Morocco',
  'México': 'Mexico',
  'Nigéria': 'Nigeria',
  'Nova Zelândia': 'New Zealand',
  'Países Baixos': 'Netherlands',
  'Panamá': 'Panama',
  'Portugal': 'Portugal',
  'RD Congo': 'DR Congo',
  'Romênia': 'Romania',
  'Senegal': 'Senegal',
  'Sérvia': 'Serbia',
  'Suíça': 'Switzerland',
  'Tunísia': 'Tunisia',
  'Turquia': 'Turkey',
  'Uruguai': 'Uruguay',
  'Uzbequistão': 'Uzbekistan',
  'Venezuela': 'Venezuela',
}

export function teamNameToEnglish(ptName: string): string {
  return PT_TO_EN[ptName] || ptName
}

export type FootballApiTeam = { id: number; name: string }

export type RecentResult = {
  date: string
  opponent: string
  opponentLogo?: string
  goalsFor: number
  goalsAgainst: number
  result: 'V' | 'E' | 'D'
  competition: string
}

export type TeamFormResponse = {
  teamId: number
  teamName: string
  recent: RecentResult[]
}

function getApiKey(): string | null {
  return process.env.FOOTBALL_API_KEY || null
}

async function footballApiFetch(path: string): Promise<any | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null
  try {
    const res = await fetch(`${FOOTBALL_API_BASE}${path}`, {
      headers: { 'x-apisports-key': apiKey },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json?.errors && Object.keys(json.errors).length > 0) return null
    return json
  } catch {
    return null
  }
}

// Busca o ID do time na API-Football a partir do nome em português do nosso banco.
export async function findTeamId(ptName: string): Promise<FootballApiTeam | null> {
  const enName = teamNameToEnglish(ptName)
  const data = await footballApiFetch(`/teams?name=${encodeURIComponent(enName)}`)
  const team = data?.response?.[0]?.team
  if (!team) return null
  return { id: team.id, name: team.name }
}

// Busca os últimos N jogos de uma seleção (independente de competição) já finalizados.
export async function getRecentForm(teamId: number, last = 5): Promise<RecentResult[]> {
  const data = await footballApiFetch(`/fixtures?team=${teamId}&last=${last}&status=FT`)
  const fixtures = data?.response || []
  return fixtures.map((f: any) => {
    const isHome = f.teams.home.id === teamId
    const goalsFor = isHome ? f.goals.home : f.goals.away
    const goalsAgainst = isHome ? f.goals.away : f.goals.home
    const opponent = isHome ? f.teams.away.name : f.teams.home.name
    const opponentLogo = isHome ? f.teams.away.logo : f.teams.home.logo
    let result: 'V' | 'E' | 'D' = 'E'
    if (goalsFor > goalsAgainst) result = 'V'
    else if (goalsFor < goalsAgainst) result = 'D'
    return {
      date: f.fixture.date,
      opponent,
      opponentLogo,
      goalsFor,
      goalsAgainst,
      result,
      competition: f.league?.name || '',
    }
  }).sort((a: RecentResult, b: RecentResult) => b.date.localeCompare(a.date))
}
