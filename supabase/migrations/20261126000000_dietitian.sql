-- BKN: diyetisyen paneli
--
-- Bir diyetisyen, yalnızca kendisine davet koduyla ve açık rızayla bağlanan danışanların
-- verilerini görebilir; danışan hangi bölümlerin (öğün ayrıntıları, vücut ölçümleri, uyku/ruh hali)
-- paylaşılacağını seçer ve bağlantıyı dilediği an sonlandırabilir.
--
-- Bu tablolara tarayıcıdan doğrudan erişim YOKTUR (RLS açık, politika yok). Tüm işlemler
-- sunucudaki /api/dietitian uçlarından, ilişki ve rıza doğrulanarak yapılır.

create table public.dietitians (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  title text check (title is null or char_length(title) <= 80),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dietitian_clients (
  id uuid primary key default gen_random_uuid(),
  dietitian_id uuid not null references public.dietitians (user_id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  include_meals boolean not null default true,
  include_body boolean not null default true,
  include_wellbeing boolean not null default false,
  -- Rızanın verildiği an; bağlantı sonlandırılınca ended_at dolar ve erişim kesilir.
  consented_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by text check (ended_by is null or ended_by in ('client', 'dietitian')),
  created_at timestamptz not null default now(),
  check (dietitian_id <> client_id)
);
-- Aynı diyetisyen-danışan çifti için aynı anda tek etkin bağlantı.
create unique index dietitian_clients_active_idx on public.dietitian_clients (dietitian_id, client_id) where ended_at is null;
create index dietitian_clients_client_idx on public.dietitian_clients (client_id);

create table public.dietitian_notes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.dietitian_clients (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  -- true: danışan da görür (öneri/mesaj). false: yalnızca diyetisyenin kendi notu.
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now()
);
create index dietitian_notes_link_idx on public.dietitian_notes (link_id, created_at desc);

alter table public.dietitians enable row level security;
alter table public.dietitian_clients enable row level security;
alter table public.dietitian_notes enable row level security;
revoke all on public.dietitians, public.dietitian_clients, public.dietitian_notes from anon, authenticated;
