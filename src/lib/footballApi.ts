// Integração com API-Football (api-football.com / api-sports.io)
// Usado para o popup de estatísticas na aba "Encerrados" de Palpites.
//
// IMPORTANTE: este módulo só deve ser chamado a partir de rotas /api/* (server-side),
// nunca diretamente do client, pois usa a chave secreta FOOTBALL_API_KEY.

const FOOTBALL_API_BASE = 'https://v3.football.api-sports.io'

// Liga e temporada da Copa do Mundo 2026 na API-Football.
// Confirmado pela documentação oficial: league=1 é "World Cup", season=2026.
const WORLD_CUP_LEAGUE_ID = 1
const WORLD_CUP_SEASON = 2026

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
// Estratégia em duas etapas para máxima precisão:
// 1) Procura dentro da lista oficial de participantes da Copa 2026 (evita ambiguidade
//    entre seleções com nomes parecidos, ex: "Korea Republic" vs "Korea DPR").
// 2) Se não encontrar ali (ex: nome grafado de forma diferente), cai para busca geral por nome.
export async function findTeamId(ptName: string): Promise<FootballApiTeam | null> {
  const enName = teamNameToEnglish(ptName)

  const wcTeams = await footballApiFetch(`/teams?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}`)
  const list = wcTeams?.response || []
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const target = normalize(enName)
  const fromWC = list.find((t: any) => normalize(t.team?.name || '') === target)
  if (fromWC?.team) return { id: fromWC.team.id, name: fromWC.team.name }

  // Fallback: busca geral por nome (caso a lista de participantes não tenha sido
  // encontrada por algum motivo, ou a grafia oficial divirja do nosso mapeamento)
  const data = await footballApiFetch(`/teams?name=${encodeURIComponent(enName)}`)
  const team = data?.response?.[0]?.team
  if (!team) return null
  return { id: team.id, name: team.name }
}

// Busca os jogos de uma seleção JÁ REALIZADOS na Copa do Mundo 2026 (até 5 mais recentes).
// Se a seleção ainda não disputou nenhum jogo na Copa 2026 (ex: antes da estreia),
// cai para o fallback de jogos recentes em qualquer competição, para não deixar o popup vazio.
export async function getRecentForm(teamId: number, last = 5): Promise<RecentResult[]> {
  const wcData = await footballApiFetch(
    `/fixtures?team=${teamId}&league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}&status=FT-AET-PEN`
  )
  let fixtures = wcData?.response || []

  if (fixtures.length === 0) {
    // Fallback: nenhum jogo da Copa 2026 encontrado ainda (ex: seleção não estreou) —
    // busca os últimos jogos em qualquer competição para não deixar o popup vazio.
    const fallbackData = await footballApiFetch(`/fixtures?team=${teamId}&last=${last}&status=FT`)
    fixtures = fallbackData?.response || []
  }

  return fixtures
    .map((f: any) => {
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
    })
    .sort((a: RecentResult, b: RecentResult) => b.date.localeCompare(a.date))
    .slice(0, last)
}
