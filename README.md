# 🏆 Bolão Copa do Mundo 2026

Bolão responsivo com sincronização automática via **The Odds API** — jogos, placares ao vivo e resultados carregam sozinhos, sem o admin precisar digitar nada.

---

## Stack
- **Next.js 14** + TypeScript
- **Tailwind CSS** — mobile-first
- **Supabase** — PostgreSQL + Realtime + RLS
- **The Odds API** — fixtures + live scores automáticos (`soccer_fifa_world_cup`)
- **Vercel Cron Jobs** — sync a cada 5 minutos, automático

---

## Como funciona a sincronização

```
Vercel Cron (a cada 5 min)
        │
        ▼
  GET /api/sync
        │
        ├─► The Odds API /events   → todos os 104 jogos (grátis, sem quota)
        ├─► The Odds API /scores   → placares ao vivo + encerrados (1 req)
        │
        ▼
  Supabase — upsert matches
        │
        ▼
  recalc_all_scores() — pontua todos os participantes
        │
        ▼
  Supabase Realtime → ranking atualiza no browser de todos
```

**Consumo estimado:** 1 req/chamada × 12 chamadas/hora × 24h × 39 dias ≈ **11.200 req** da Copa inteira.
Com 20.000 disponíveis, sobra bastante margem. ✅

---

## 🚀 Setup em 4 passos

### 1. Supabase

1. Crie projeto em [supabase.com](https://supabase.com)
2. **SQL Editor → New query** → cole `supabase_schema.sql` → **Run**
3. Em **Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ nunca exponha no client

### 2. The Odds API

1. Acesse [the-odds-api.com/account](https://the-odds-api.com/account/)
2. Copie sua API key → `ODDS_API_KEY`

### 3. GitHub + Vercel

```bash
git init && git add . && git commit -m "feat: bolão copa 2026"
git remote add origin https://github.com/SEU_USUARIO/bolao-copa-2026.git
git push -u origin main
```

No Vercel → **Add New Project** → importe o repo → adicione as variáveis:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `ODDS_API_KEY` | sua key da The Odds API |
| `NEXT_PUBLIC_ADMIN_NICKNAME` | seu apelido (ex: `joao`) |
| `CRON_SECRET` | string aleatória segura |
| `NEXT_PUBLIC_CRON_SECRET` | mesma string acima |

Deploy → compartilhe o link! 🎉

### 4. Primeiro sync

Após o deploy, acesse `/admin` com seu apelido e clique em **"Sincronizar agora"**.
Os 104 jogos da Copa 2026 serão importados automaticamente da The Odds API.
A partir daí o cron cuida de tudo a cada 5 minutos.

---

## 📱 Fluxo do usuário

```
Login (apelido)
    ↓
Palpite de campeão 🥇+50 / 🥈+25 / 🥉+10  (bloqueado após 1º jogo ao vivo)
    ↓
Palpites de placar por fase  (bloqueados ao iniciar o jogo)
    ↓
Ranking em tempo real  (atualiza automaticamente após cada resultado)
```

---

## ⚙️ Painel Admin (`/admin`)

- **Sincronizar agora** — força sync imediato com The Odds API
- **Corrigir resultado** ✏️ — override manual (ex: prorrogação/pênaltis)
- **Marcar ao vivo** — força status live sem esperar o cron
- **Reset** — volta partida para "em breve"

---

## 🏆 Pontuação

| Fator | Critério | Pts |
|---|---|---|
| F10 | Placar exato | 10 |
| F7 | Resultado + escore de 1 time | 7 |
| F5 | Resultado (V/E/D) | 5 |
| F2 | Escore de 1 time | 2 |
| F0 | Nenhum | 0 |

**Extra:** 🥇 Campeão +50 · 🥈 Vice +25 · 🥉 3º +10

**Desempate (ordem):** F10 → F7 → F5 → F2 → F0 → MT → Data de entrada

---

## 📁 Estrutura

```
src/
├── lib/
│   ├── supabase.ts      # Client, types, helpers de pontuação
│   ├── auth.tsx         # Contexto de autenticação por apelido
│   └── oddsSync.ts      # ★ Integração The Odds API → Supabase
├── pages/
│   ├── index.tsx        # Login
│   ├── champion.tsx     # Palpite de campeão
│   ├── picks.tsx        # Palpites de placar
│   ├── ranking.tsx      # Ranking realtime
│   ├── admin.tsx        # Painel admin + sync
│   └── api/
│       ├── sync.ts      # ★ Endpoint do cron (Vercel → aqui → OddsAPI → Supabase)
│       └── admin/
│           └── result.ts # Override manual de resultado
vercel.json              # ★ Cron job: /api/sync a cada 5 min
supabase_schema.sql      # Tabelas, RLS, funções SQL
```

---

## 🔧 Dev local

```bash
npm install
cp .env.local.example .env.local
# Preencha as variáveis
npm run dev
# Testar sync manualmente:
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"secret":"SEU_CRON_SECRET"}'
```

---

## 🔌 Integração — The Odds API (dados automáticos)

### Como funciona

```
The Odds API
    ↓ (a cada 5 min via Vercel Cron)
/api/sync  [Next.js API route — server-side, API key protegida]
    ↓
Supabase (atualiza matches: status, placar)
    ↓
recalc_all_scores() — recalcula ranking
    ↓
Supabase Realtime → todos os participantes veem ao vivo
```

### Endpoints utilizados

| Endpoint | Custo | O que faz |
|----------|-------|-----------|
| `GET /v4/sports/soccer_fifa_world_cup/events` | **0 requests** | Busca todos os 104 jogos (fixture) |
| `GET /v4/sports/soccer_fifa_world_cup/scores?daysFrom=3` | **1 request** | Placares ao vivo + encerrados (3 dias) |

### Consumo estimado

- Cron a cada 5 min = **288 calls/dia** (apenas o endpoint de scores conta)
- Com 20k de créditos: **~69 dias** de cobertura completa

> 💡 Durante dias sem jogos, o cron ainda roda mas retorna `0 updated` — gasta 1 request por execução.
> Se quiser economizar, pode ajustar o cron para `*/15 * * * *` (a cada 15 min) fora dos dias de jogo.

### Variáveis necessárias no Vercel

| Variável | Onde encontrar |
|----------|----------------|
| `ODDS_API_KEY` | [the-odds-api.com/account](https://the-odds-api.com/account/) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `CRON_SECRET` | Qualquer string aleatória — Vercel envia como `Authorization: Bearer <valor>` |

### ⚠️ Segurança

A `ODDS_API_KEY` **nunca é enviada ao frontend**. Ela só existe em variáveis server-side do Vercel e é usada exclusivamente nas API Routes (`/api/sync`).

Se a key foi exposta, regenere em [the-odds-api.com/account](https://the-odds-api.com/account/).
