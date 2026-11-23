-- BKNY: "Buzdolabından yemeğe" envanteri. Kullanıcının buzdolabı, buzluk ve dolaptaki ürünleri;
-- tüketim süresi paketten okunan tarih ya da tahmini saklama süresidir (gıda güvenliği garantisi değildir).
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  location text not null default 'fridge' check (location in ('fridge', 'freezer', 'pantry')),
  added_on date not null default current_date,
  -- Paket üzerinde okunan ya da kullanıcının girdiği son tüketim tarihi
  expires_on date,
  -- Tarih yoksa, eklenme tarihinden itibaren tahmini saklama süresi (gün)
  shelf_days integer check (shelf_days is null or shelf_days between 0 and 1100),
  expiry_source text not null default 'estimate' check (expiry_source in ('label', 'estimate', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pantry_items_user_idx on public.pantry_items (user_id);
create trigger pantry_items_updated_at before update on public.pantry_items
for each row execute function public.set_updated_at();

alter table public.pantry_items enable row level security;
create policy "pantry_items_select_own" on public.pantry_items for select to authenticated using (auth.uid() = user_id);
create policy "pantry_items_insert_own" on public.pantry_items for insert to authenticated with check (auth.uid() = user_id);
create policy "pantry_items_update_own" on public.pantry_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pantry_items_delete_own" on public.pantry_items for delete to authenticated using (auth.uid() = user_id);
