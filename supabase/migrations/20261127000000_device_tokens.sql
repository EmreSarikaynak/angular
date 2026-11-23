-- BKN: mobil uygulama bildirimleri (Firebase Cloud Messaging) için cihaz belirteçleri
--
-- Tarayıcıdan doğrudan erişim YOKTUR (RLS açık, politika yok); kayıt ve silme işlemleri
-- sunucudaki /api/devices ucundan, oturum doğrulanarak yapılır. Aynı cihaz başka bir hesapla
-- giriş yaptığında belirteç yeni hesaba devredilir.

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique check (char_length(token) between 20 and 4096),
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from anon, authenticated;
