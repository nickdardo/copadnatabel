-- ============================================================
-- BOLÃO COPA 2026 — Schema Supabase
-- Execute no SQL Editor do seu projeto Supabase
-- ============================================================

-- EXTENSÕES
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELA: players (participantes)
-- ============================================================
create table if not exists public.players (
  id          uuid primary key default uuid_generate_v4(),
  nickname    text not null unique,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.players enable row level security;

create policy "players_select_all" on public.players
  for select using (true);

create policy "players_insert_anyone" on public.players
  for insert with check (true);

-- ============================================================
-- TABELA: matches (partidas)
-- ============================================================
create table if not exists public.matches (
  id            uuid primary key default uuid_generate_v4(),
  odds_event_id text unique,          -- ID from The Odds API (for upsert sync)
  home_team     text not null,
  away_team     text not null,
  home_flag     text,
  away_flag     text,
  match_date    timestamptz,
  fase          text not null default 'Fase de Grupos',
  -- status: upcoming | live | done
  status        text not null default 'upcoming',
  score_home    int,
  score_away    int,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.matches enable row level security;

create policy "matches_select_all" on public.matches
  for select using (true);

-- somente via API com admin_secret (tratado no backend)
create policy "matches_admin_all" on public.matches
  for all using (true);

-- ============================================================
-- TABELA: champion_picks (palpites de campeão/vice/3º)
-- ============================================================
create table if not exists public.champion_picks (
  id            uuid primary key default uuid_generate_v4(),
  player_id     uuid not null references public.players(id) on delete cascade,
  pick_champion text not null,
  pick_runner   text not null,
  pick_third    text not null,
  locked        boolean not null default false,
  created_at    timestamptz not null default now(),
  unique(player_id)
);
alter table public.champion_picks enable row level security;

create policy "champion_picks_select_all" on public.champion_picks
  for select using (true);

create policy "champion_picks_insert_own" on public.champion_picks
  for insert with check (true);

create policy "champion_picks_update_own" on public.champion_picks
  for update using (true);

-- ============================================================
-- TABELA: picks (palpites de placar por partida)
-- ============================================================
create table if not exists public.picks (
  id            uuid primary key default uuid_generate_v4(),
  player_id     uuid not null references public.players(id) on delete cascade,
  match_id      uuid not null references public.matches(id) on delete cascade,
  pick_home     int not null,
  pick_away     int not null,
  submitted_at  timestamptz not null default now(),
  unique(player_id, match_id)
);
alter table public.picks enable row level security;

create policy "picks_select_all" on public.picks
  for select using (true);

create policy "picks_insert_own" on public.picks
  for insert with check (true);

create policy "picks_update_own" on public.picks
  for update using (true);

-- ============================================================
-- TABELA: scores (pontuação calculada — atualizada pelo backend)
-- ============================================================
create table if not exists public.scores (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid not null references public.players(id) on delete cascade unique,
  total_pts       int not null default 0,
  f10_count       int not null default 0,
  f7_count        int not null default 0,
  f5_count        int not null default 0,
  f2_count        int not null default 0,
  f0_count        int not null default 0,
  champion_pts    int not null default 0,
  updated_at      timestamptz not null default now()
);
alter table public.scores enable row level security;

create policy "scores_select_all" on public.scores
  for select using (true);

create policy "scores_upsert_all" on public.scores
  for all using (true);

-- ============================================================
-- DADOS INICIAIS — Jogos da Copa 2026
-- Fase de Grupos (amostra — todos os 104 jogos devem ser inseridos)
-- ============================================================

-- GRUPOS — datas e horários em UTC (ajuste conforme fuso desejado)
insert into public.matches (home_team, home_flag, away_team, away_flag, match_date, fase, sort_order) values
-- Jogo de abertura
('México',     '🇲🇽', 'Equador',    '🇪🇨', '2026-06-11 23:00:00+00', 'Fase de Grupos', 1),
('Estados Unidos','🇺🇸','Canadá',   '🇨🇦', '2026-06-12 22:00:00+00', 'Fase de Grupos', 2),
('Uruguai',    '🇺🇾', 'Alemanha',   '🇩🇪', '2026-06-13 00:00:00+00', 'Fase de Grupos', 3),
('Argentina',  '🇦🇷', 'Marrocos',   '🇲🇦', '2026-06-13 22:00:00+00', 'Fase de Grupos', 4),
('Espanha',    '🇪🇸', 'Bélgica',    '🇧🇪', '2026-06-14 01:00:00+00', 'Fase de Grupos', 5),
('França',     '🇫🇷', 'Croácia',    '🇭🇷', '2026-06-14 22:00:00+00', 'Fase de Grupos', 6),
('Brasil',     '🇧🇷', 'Japão',      '🇯🇵', '2026-06-15 01:00:00+00', 'Fase de Grupos', 7),
('Portugal',   '🇵🇹', 'Coreia do Sul','🇰🇷','2026-06-15 22:00:00+00','Fase de Grupos', 8),
('Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Sérvia',    '🇷🇸', '2026-06-16 01:00:00+00', 'Fase de Grupos', 9),
('Países Baixos','🇳🇱','Senegal',   '🇸🇳', '2026-06-16 22:00:00+00', 'Fase de Grupos', 10),
('Itália',     '🇮🇹', 'Albânia',    '🇦🇱', '2026-06-17 01:00:00+00', 'Fase de Grupos', 11),
('Austrália',  '🇦🇺', 'Nigéria',    '🇳🇬', '2026-06-17 22:00:00+00', 'Fase de Grupos', 12),
('Colômbia',   '🇨🇴', 'Equador',    '🇪🇨', '2026-06-18 01:00:00+00', 'Fase de Grupos', 13),
('México',     '🇲🇽', 'Camarões',   '🇨🇲', '2026-06-18 22:00:00+00', 'Fase de Grupos', 14),
('Alemanha',   '🇩🇪', 'Arábia Saudita','🇸🇦','2026-06-19 01:00:00+00','Fase de Grupos', 15),
('Argentina',  '🇦🇷', 'Chile',      '🇨🇱', '2026-06-19 22:00:00+00', 'Fase de Grupos', 16),
('Espanha',    '🇪🇸', 'Cazaquistão','🇰🇿', '2026-06-20 01:00:00+00', 'Fase de Grupos', 17),
('França',     '🇫🇷', 'México',     '🇲🇽', '2026-06-20 22:00:00+00', 'Fase de Grupos', 18),
('Brasil',     '🇧🇷', 'Arábia Saudita','🇸🇦','2026-06-21 01:00:00+00','Fase de Grupos', 19),
('Portugal',   '🇵🇹', 'Tchéquia',   '🇨🇿', '2026-06-21 22:00:00+00', 'Fase de Grupos', 20),
('Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Eslovênia', '🇸🇮', '2026-06-22 01:00:00+00', 'Fase de Grupos', 21),
('Países Baixos','🇳🇱','Turquia',   '🇹🇷', '2026-06-22 22:00:00+00', 'Fase de Grupos', 22),
('Itália',     '🇮🇹', 'Romênia',    '🇷🇴', '2026-06-23 01:00:00+00', 'Fase de Grupos', 23),
('Uruguai',    '🇺🇾', 'Moçambique', '🇲🇿', '2026-06-23 22:00:00+00', 'Fase de Grupos', 24)
on conflict do nothing;

-- ============================================================
-- FUNÇÃO: calcular fator de pontuação
-- ============================================================
create or replace function public.calc_factor(
  pick_h int, pick_a int,
  real_h int, real_a int
) returns text language plpgsql as $$
declare
  pick_res text;
  real_res text;
begin
  if real_h is null or real_a is null then return null; end if;
  pick_res := case when pick_h > pick_a then 'H' when pick_h < pick_a then 'A' else 'D' end;
  real_res := case when real_h > real_a then 'H' when real_h < real_a then 'A' else 'D' end;
  if pick_h = real_h and pick_a = real_a then return 'F10'; end if;
  if pick_res = real_res and (pick_h = real_h or pick_a = real_a) then return 'F7'; end if;
  if pick_res = real_res then return 'F5'; end if;
  if pick_h = real_h or pick_a = real_a then return 'F2'; end if;
  return 'F0';
end;
$$;

-- ============================================================
-- FUNÇÃO: recalcular pontuação de todos os jogadores
-- (Chamada via API após inserir resultado)
-- ============================================================
create or replace function public.recalc_all_scores() returns void language plpgsql as $$
declare
  rec record;
  pts int; f10 int; f7 int; f5 int; f2 int; f0 int; camp_pts int;
  factor text;
  champ record;
  final_match record;
begin
  for rec in select id from public.players loop
    pts := 0; f10 := 0; f7 := 0; f5 := 0; f2 := 0; f0 := 0; camp_pts := 0;

    -- pontos por partida
    for factor in
      select public.calc_factor(p.pick_home, p.pick_away, m.score_home, m.score_away)
      from public.picks p
      join public.matches m on m.id = p.match_id
      where p.player_id = rec.id and m.status = 'done' and m.score_home is not null
    loop
      case factor
        when 'F10' then pts := pts + 10; f10 := f10 + 1;
        when 'F7'  then pts := pts + 7;  f7  := f7  + 1;
        when 'F5'  then pts := pts + 5;  f5  := f5  + 1;
        when 'F2'  then pts := pts + 2;  f2  := f2  + 1;
        when 'F0'  then                  f0  := f0  + 1;
        else null;
      end case;
    end loop;

    -- pontos de campeão (verificado após fase final)
    select * into champ from public.champion_picks where player_id = rec.id;
    select * into final_match from public.matches
      where fase = 'Final' and status = 'done' limit 1;

    if champ is not null and final_match is not null then
      -- campeão: time com mais gols na final
      if final_match.score_home > final_match.score_away then
        if champ.pick_champion = final_match.home_team then camp_pts := camp_pts + 50; end if;
        if champ.pick_runner    = final_match.away_team then camp_pts := camp_pts + 25; end if;
      elsif final_match.score_away > final_match.score_home then
        if champ.pick_champion = final_match.away_team then camp_pts := camp_pts + 50; end if;
        if champ.pick_runner   = final_match.home_team then camp_pts := camp_pts + 25; end if;
      end if;
    end if;

    -- 3º lugar
    declare
      third_match record;
    begin
      select * into third_match from public.matches
        where fase = 'Terceiro Lugar' and status = 'done' limit 1;
      if champ is not null and third_match is not null then
        if third_match.score_home > third_match.score_away then
          if champ.pick_third = third_match.home_team then camp_pts := camp_pts + 10; end if;
        elsif third_match.score_away > third_match.score_home then
          if champ.pick_third = third_match.away_team then camp_pts := camp_pts + 10; end if;
        end if;
      end if;
    end;

    pts := pts + camp_pts;

    insert into public.scores (player_id, total_pts, f10_count, f7_count, f5_count, f2_count, f0_count, champion_pts, updated_at)
    values (rec.id, pts, f10, f7, f5, f2, f0, camp_pts, now())
    on conflict (player_id) do update set
      total_pts    = excluded.total_pts,
      f10_count    = excluded.f10_count,
      f7_count     = excluded.f7_count,
      f5_count     = excluded.f5_count,
      f2_count     = excluded.f2_count,
      f0_count     = excluded.f0_count,
      champion_pts = excluded.champion_pts,
      updated_at   = now();
  end loop;
end;
$$;

-- ============================================================
-- MIGRATION: adicionar odds_event_id à tabela matches
-- (Execute após o schema inicial se o projeto já existia)
-- ============================================================
alter table public.matches
  add column if not exists odds_event_id text unique;

create index if not exists matches_odds_event_id_idx
  on public.matches(odds_event_id);
