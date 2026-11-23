-- BKN: takviyeler, sağlık halkaları, bildirim tercihleri ve bildirim kaydı

-- ---------------------------------------------------------------------------
-- Takviyeler: kullanıcı adını, dozunu ve saatlerini kendisi girer.
-- Uygulama doz ÖNERMEZ; yalnızca kullanıcının girdiği planı hatırlatır.
-- ---------------------------------------------------------------------------
create table public.supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  dose text check (dose is null or char_length(dose) <= 80),
  -- "HH:MM" biçiminde günlük saatler
  times text[] not null default '{}' check (cardinality(times) between 1 and 8),
  active boolean not null default true,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supplements_user_idx on public.supplements (user_id);
create trigger supplements_updated_at before update on public.supplements
for each row execute function public.set_updated_at();

create table public.supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  entry_date date not null,
  time_slot text not null check (time_slot ~ '^\d{2}:\d{2}$'),
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (supplement_id, entry_date, time_slot)
);
create index supplement_logs_user_date_idx on public.supplement_logs (user_id, entry_date);

-- ---------------------------------------------------------------------------
-- Sağlık halkaları: akıllı saat / telefon ekran görüntüsünden ya da elle
-- ---------------------------------------------------------------------------
create table public.health_rings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  move_kcal integer check (move_kcal is null or move_kcal between 0 and 20000),
  move_goal integer check (move_goal is null or move_goal between 1 and 20000),
  exercise_min integer check (exercise_min is null or exercise_min between 0 and 1440),
  exercise_goal integer check (exercise_goal is null or exercise_goal between 1 and 1440),
  stand_hours integer check (stand_hours is null or stand_hours between 0 and 24),
  stand_goal integer check (stand_goal is null or stand_goal between 1 and 24),
  steps integer check (steps is null or steps between 0 and 200000),
  distance_km numeric(6, 2) check (distance_km is null or distance_km between 0 and 500),
  source text not null default 'manual' check (source in ('manual', 'screenshot')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);
create trigger health_rings_updated_at before update on public.health_rings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Bildirim tercihleri
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column notify_supplements boolean not null default true,
  -- Alınmayan takviye için tekrar hatırlatma aralığı (dk); 0 = tekrar etme
  add column supplement_nag_min integer not null default 30 check (supplement_nag_min in (0, 15, 30, 60, 120)),
  add column notify_protein boolean not null default true,
  add column protein_check_hour integer not null default 18 check (protein_check_hour between 0 and 23),
  add column notify_insights boolean not null default true,
  add column notify_summary boolean not null default true;

-- Aynı bildirimin iki kez gönderilmesini önleyen kayıt (yalnızca sunucu yazar).
create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, key)
);
create index notification_log_sent_idx on public.notification_log (sent_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['supplements', 'supplement_logs', 'health_rings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select_own" on public.%I for select to authenticated using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_update_own" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete to authenticated using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;
