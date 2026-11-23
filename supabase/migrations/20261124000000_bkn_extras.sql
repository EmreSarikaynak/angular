-- BKN ek özellikler: takviye stoku, kafein, aralıklı oruç, öğün planı, paylaşım bağlantıları, akşam kapanışı

-- ---------------------------------------------------------------------------
-- Takviye stoku
-- ---------------------------------------------------------------------------
alter table public.supplements
  -- Kutuda kalan adet (kapsül/tablet/ölçek). null = stok takip edilmiyor.
  add column stock_count integer check (stock_count is null or stock_count between 0 and 100000),
  -- Her alımda düşülecek adet.
  add column per_dose integer not null default 1 check (per_dose between 1 and 100);

-- ---------------------------------------------------------------------------
-- Kafein
-- ---------------------------------------------------------------------------
alter table public.food_entries
  add column caffeine_mg numeric(7, 1) not null default 0 check (caffeine_mg between 0 and 5000);

-- ---------------------------------------------------------------------------
-- Aralıklı oruç
-- ---------------------------------------------------------------------------
create table public.fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  target_hours numeric(4, 1) not null default 16 check (target_hours between 1 and 72),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index fasting_sessions_user_date_idx on public.fasting_sessions (user_id, entry_date);
create trigger fasting_sessions_updated_at before update on public.fasting_sessions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Haftalık öğün planı ve alışveriş listesi
-- ---------------------------------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  plan jsonb not null,
  -- Alışveriş listesinde işaretlenen kalemler
  checked text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meal_plans_user_idx on public.meal_plans (user_id, created_at desc);
create trigger meal_plans_updated_at before update on public.meal_plans
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Diyetisyen / koç paylaşımı: kullanıcının kendi oluşturduğu salt okunur bağlantılar.
-- Bağlantıdaki gizli belirtecin yalnızca SHA-256 özeti saklanır.
-- ---------------------------------------------------------------------------
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  label text check (label is null or char_length(label) <= 80),
  days integer not null default 30 check (days in (7, 30, 90)),
  include_meals boolean not null default true,
  include_body boolean not null default true,
  include_wellbeing boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index share_links_user_idx on public.share_links (user_id);

-- ---------------------------------------------------------------------------
-- Tercihler
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column notify_evening boolean not null default true,
  add column evening_hour integer not null default 21 check (evening_hour between 0 and 23),
  add column fasting_target_hours numeric(4, 1) not null default 16 check (fasting_target_hours between 1 and 72);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['fasting_sessions', 'meal_plans', 'share_links']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select_own" on public.%I for select to authenticated using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_update_own" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete to authenticated using (auth.uid() = user_id)', t, t);
  end loop;
end $$;
