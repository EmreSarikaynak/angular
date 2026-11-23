-- Besin Takip: başlangıç şeması
-- Tüm kullanıcı tabloları satır düzeyinde güvenlik (RLS) ile korunur:
-- her kullanıcı yalnızca kendi satırlarını görebilir ve değiştirebilir.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profil
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  birth_date date,
  sex text check (sex in ('male', 'female')),
  height_cm numeric(5, 1) check (height_cm between 80 and 260),
  start_weight_kg numeric(5, 1) check (start_weight_kg between 20 and 400),
  weight_kg numeric(5, 1) check (weight_kg between 20 and 400),
  target_weight_kg numeric(5, 1) check (target_weight_kg between 20 and 400),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text check (goal in ('lose', 'maintain', 'gain')),
  weekly_rate_kg numeric(3, 2) not null default 0.5 check (weekly_rate_kg between 0 and 1),
  allergies text[] not null default '{}',
  diet_preferences text[] not null default '{}',
  kcal_target integer check (kcal_target between 800 and 8000),
  protein_target_g integer check (protein_target_g between 0 and 600),
  carbs_target_g integer check (carbs_target_g between 0 and 1200),
  fat_target_g integer check (fat_target_g between 0 and 500),
  water_target_ml integer check (water_target_ml between 500 and 8000),
  steps_target integer not null default 8000 check (steps_target between 0 and 100000),
  targets_custom boolean not null default false,
  add_exercise_calories boolean not null default false,
  store_photos boolean not null default true,
  language text not null default 'tr' check (language in ('tr', 'en')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  timezone text not null default 'Europe/Istanbul',
  reminder_enabled boolean not null default false,
  reminder_interval_min integer not null default 120 check (reminder_interval_min between 30 and 480),
  reminder_start_hour integer not null default 9 check (reminder_start_hour between 0 and 23),
  reminder_end_hour integer not null default 21 check (reminder_end_hour between 0 and 23),
  last_reminder_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Yeni kayıt olan her kullanıcı için boş profil satırı oluştur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, language)
  values (
    new.id,
    nullif(left(new.raw_user_meta_data ->> 'first_name', 80), ''),
    nullif(left(new.raw_user_meta_data ->> 'last_name', 80), ''),
    case when new.raw_user_meta_data ->> 'language' = 'en' then 'en' else 'tr' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Yiyecek ve içecek kayıtları (içecekler meal = 'drink' ile aynı tabloda)
-- ---------------------------------------------------------------------------
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  consumed_at timestamptz not null default now(),
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'night', 'drink')),
  name text not null check (char_length(name) between 1 and 200),
  quantity numeric(8, 2),
  unit text,
  grams numeric(8, 1) check (grams is null or grams between 0 and 10000),
  kcal numeric(8, 1) not null default 0 check (kcal between 0 and 20000),
  protein_g numeric(7, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7, 1) not null default 0 check (fat_g >= 0),
  sugar_g numeric(7, 1) not null default 0 check (sugar_g >= 0),
  fiber_g numeric(7, 1) not null default 0 check (fiber_g >= 0),
  salt_g numeric(7, 2) not null default 0 check (salt_g >= 0),
  alcohol_g numeric(7, 1) not null default 0 check (alcohol_g >= 0),
  source text not null default 'manual' check (source in ('photo', 'text', 'barcode', 'label', 'manual', 'favorite', 'drink')),
  data_source text not null default 'user' check (data_source in ('reference', 'ai', 'openfoodfacts', 'label', 'user')),
  is_estimated boolean not null default false,
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  photo_path text,
  group_id uuid,
  group_name text,
  drink_type text,
  volume_ml numeric(7, 1) check (volume_ml is null or volume_ml between 0 and 10000),
  abv numeric(4, 1) check (abv is null or abv between 0 and 100),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_entries_user_date_idx on public.food_entries (user_id, entry_date);
create trigger food_entries_updated_at before update on public.food_entries
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Su
-- ---------------------------------------------------------------------------
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  logged_at timestamptz not null default now(),
  amount_ml integer not null check (amount_ml between 1 and 5000),
  created_at timestamptz not null default now()
);
create index water_logs_user_date_idx on public.water_logs (user_id, entry_date);

-- ---------------------------------------------------------------------------
-- Aktiviteler
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  started_at timestamptz not null default now(),
  type text not null,
  name text,
  duration_min numeric(6, 1) not null check (duration_min between 1 and 1440),
  distance_km numeric(6, 2) check (distance_km is null or distance_km between 0 and 500),
  intensity text not null default 'moderate' check (intensity in ('low', 'moderate', 'high')),
  met numeric(4, 1),
  kcal_burned numeric(7, 1) not null default 0 check (kcal_burned between 0 and 20000),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_user_date_idx on public.activities (user_id, entry_date);
create trigger activities_updated_at before update on public.activities
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Günlük durum: adım, uyku, ruh hali (kullanıcı + gün başına tek satır)
-- ---------------------------------------------------------------------------
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  steps integer check (steps is null or steps between 0 and 200000),
  sleep_hours numeric(3, 1) check (sleep_hours is null or sleep_hours between 0 and 24),
  sleep_quality smallint check (sleep_quality is null or sleep_quality between 1 and 5),
  mood smallint check (mood is null or mood between 1 and 5),
  energy smallint check (energy is null or energy between 1 and 5),
  stress smallint check (stress is null or stress between 1 and 5),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);
create trigger daily_logs_updated_at before update on public.daily_logs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vücut ölçümleri
-- ---------------------------------------------------------------------------
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  weight_kg numeric(5, 1) check (weight_kg is null or weight_kg between 20 and 400),
  waist_cm numeric(5, 1) check (waist_cm is null or waist_cm between 20 and 300),
  hip_cm numeric(5, 1) check (hip_cm is null or hip_cm between 20 and 300),
  chest_cm numeric(5, 1) check (chest_cm is null or chest_cm between 20 and 300),
  body_fat_pct numeric(4, 1) check (body_fat_pct is null or body_fat_pct between 1 and 75),
  bmi numeric(4, 1),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index body_measurements_user_date_idx on public.body_measurements (user_id, entry_date);
create trigger body_measurements_updated_at before update on public.body_measurements
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Favoriler
-- ---------------------------------------------------------------------------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  items jsonb not null,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index favorites_user_idx on public.favorites (user_id);
create trigger favorites_updated_at before update on public.favorites
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Asistan sohbet geçmişi
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  created_at timestamptz not null default now()
);
create index chat_messages_user_idx on public.chat_messages (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Bildirim abonelikleri (Web Push)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- RLS: kullanıcı tabloları
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'food_entries', 'water_logs', 'activities', 'daily_logs',
    'body_measurements', 'favorites', 'chat_messages', 'push_subscriptions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select_own" on public.%I for select to authenticated using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_update_own" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete to authenticated using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Yönetim tabloları: RLS açık, politika YOK.
-- Yalnızca sunucudaki service_role anahtarı erişebilir; tarayıcıdan erişilemez.
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.user_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_ai_limit integer check (daily_ai_limit is null or daily_ai_limit between 0 and 10000),
  blocked boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  cached boolean not null default false,
  status text not null default 'ok' check (status in ('ok', 'error', 'rate_limited')),
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_created_idx on public.ai_usage (created_at desc);

create table public.ai_cache (
  key text primary key,
  kind text not null,
  model text not null,
  response jsonb not null,
  hits integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.error_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  source text not null,
  message text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index error_logs_created_idx on public.error_logs (created_at desc);

alter table public.admins enable row level security;
alter table public.app_settings enable row level security;
alter table public.user_limits enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_cache enable row level security;
alter table public.error_logs enable row level security;

revoke all on public.admins, public.app_settings, public.user_limits,
  public.ai_usage, public.ai_cache, public.error_logs from anon, authenticated;

-- Yönetim paneli için toplu sayılar (kişisel sağlık verisi içermez).
create or replace function public.admin_overview()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'users_total', (select count(*) from auth.users),
    'users_onboarded', (select count(*) from profiles where onboarded_at is not null),
    'users_new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_users_7d', (
      select count(distinct user_id) from (
        select user_id from food_entries where created_at > now() - interval '7 days'
        union select user_id from water_logs where created_at > now() - interval '7 days'
        union select user_id from activities where created_at > now() - interval '7 days'
      ) a
    ),
    'food_entries_total', (select count(*) from food_entries),
    'food_entries_7d', (select count(*) from food_entries where created_at > now() - interval '7 days'),
    'water_logs_total', (select count(*) from water_logs),
    'activities_total', (select count(*) from activities),
    'photo_entries_total', (select count(*) from food_entries where source = 'photo'),
    'ai_calls_today', (select count(*) from ai_usage where created_at >= date_trunc('day', now())),
    'ai_calls_30d', (select count(*) from ai_usage where created_at > now() - interval '30 days'),
    'ai_cost_30d', (select coalesce(sum(cost_usd), 0) from ai_usage where created_at > now() - interval '30 days'),
    'ai_cache_hits_30d', (select count(*) from ai_usage where cached and created_at > now() - interval '30 days'),
    'errors_24h', (select count(*) from error_logs where created_at > now() - interval '24 hours')
  );
$$;
revoke all on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;

create or replace function public.admin_usage_daily(days integer default 30)
returns table (day date, calls bigint, cached_calls bigint, errors bigint, input_tokens bigint, output_tokens bigint, cost_usd numeric)
language sql
security definer
set search_path = public
as $$
  select created_at::date as day,
         count(*) as calls,
         count(*) filter (where cached) as cached_calls,
         count(*) filter (where status <> 'ok') as errors,
         coalesce(sum(input_tokens), 0) as input_tokens,
         coalesce(sum(output_tokens), 0) as output_tokens,
         coalesce(sum(cost_usd), 0) as cost_usd
  from ai_usage
  where created_at > now() - make_interval(days => days)
  group by 1
  order by 1;
$$;
revoke all on function public.admin_usage_daily(integer) from public, anon, authenticated;
grant execute on function public.admin_usage_daily(integer) to service_role;

create or replace function public.admin_usage_by_user(days integer default 30)
returns table (user_id uuid, calls bigint, calls_today bigint, cost_usd numeric)
language sql
security definer
set search_path = public
as $$
  select user_id,
         count(*) as calls,
         count(*) filter (where created_at >= date_trunc('day', now())) as calls_today,
         coalesce(sum(cost_usd), 0) as cost_usd
  from ai_usage
  where user_id is not null and created_at > now() - make_interval(days => days)
  group by 1;
$$;
revoke all on function public.admin_usage_by_user(integer) from public, anon, authenticated;
grant execute on function public.admin_usage_by_user(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Depolama: özel "meal-photos" kovası; herkes yalnızca kendi klasörüne erişir.
-- Dosya yolu biçimi: <user_id>/<uuid>.jpg
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "meal_photos_select_own" on storage.objects for select to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal_photos_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal_photos_update_own" on storage.objects for update to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal_photos_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
