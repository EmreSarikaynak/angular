-- Premium abonelik durumu. Yalnızca sunucu (service role) yazar; kullanıcı kendi satırını okuyabilir.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('active', 'cancelled', 'billing_issue', 'expired')),
  product_id text,
  store text,
  period_end timestamptz,
  will_renew boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.subscriptions from anon, authenticated;
