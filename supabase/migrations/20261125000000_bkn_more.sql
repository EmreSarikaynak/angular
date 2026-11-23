-- BKN: kendi tariflerim, haftalık mektup, meydan okumalar, döngü takibi, mikro besinler, Ramazan modu

-- ---------------------------------------------------------------------------
-- Kendi tariflerim
-- ---------------------------------------------------------------------------
create table public.user_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  servings numeric(5, 1) not null default 1 check (servings between 0.5 and 100),
  -- Malzemeler: her biri bir yiyecek kalemi (ad, gram, besin değerleri)
  ingredients jsonb not null,
  note text check (note is null or char_length(note) <= 1000),
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_recipes_user_idx on public.user_recipes (user_id);
create trigger user_recipes_updated_at before update on public.user_recipes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Haftalık mektup (haftada bir, kullanıcının isteğiyle üretilir)
-- ---------------------------------------------------------------------------
create table public.weekly_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Mektubun kapsadığı haftanın son günü
  entry_date date not null,
  content text not null check (char_length(content) <= 6000),
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- ---------------------------------------------------------------------------
-- Regl döngüsü: her satır bir adet dönemi. Yapay zekâya ve paylaşım raporlarına ASLA gönderilmez.
-- ---------------------------------------------------------------------------
create table public.cycle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  end_date date,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date),
  check (end_date is null or (end_date >= entry_date and end_date <= entry_date + 14))
);
create trigger cycle_logs_updated_at before update on public.cycle_logs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mikro besinler (vitamin ve mineraller): yapay zekâ tahmini, kalem başına
-- ---------------------------------------------------------------------------
alter table public.food_entries add column micros jsonb;

-- ---------------------------------------------------------------------------
-- Ramazan modu
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column ramadan_mode boolean not null default false,
  add column iftar_time text not null default '19:00' check (iftar_time ~ '^\d{2}:\d{2}$'),
  add column sahur_time text not null default '04:30' check (sahur_time ~ '^\d{2}:\d{2}$');

-- ---------------------------------------------------------------------------
-- RLS: kullanıcıya ait tablolar
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['user_recipes', 'weekly_letters', 'cycle_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select_own" on public.%I for select to authenticated using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_update_own" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete to authenticated using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Arkadaşla meydan okuma.
-- Üyeler birbirinin YALNIZCA takma adını ve tamamladığı gün sayısını görür; sağlık kaydı paylaşılmaz.
-- Bu tablolara tarayıcıdan doğrudan erişim yoktur (politika yok); tüm işlemler sunucudaki
-- /api/challenges uçlarından, üyelik doğrulanarak yapılır.
-- ---------------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  metric text not null check (metric in ('logging', 'water', 'protein', 'steps')),
  days integer not null check (days in (7, 14, 30)),
  start_date date not null,
  join_code text not null unique check (join_code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

create table public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  progress integer not null default 0 check (progress between 0 and 31),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index challenge_members_user_idx on public.challenge_members (user_id);

alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
revoke all on public.challenges, public.challenge_members from anon, authenticated;
