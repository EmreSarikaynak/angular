-- Yönetim paneli: plan yönetimi, elle Premium, kullanıcı bazlı kullanım ve etkinlik sayaçları.

-- Yönetici tarafından elle verilen Premium (abonelik olmadan).
alter table public.user_limits add column if not exists premium_override boolean not null default false;
alter table public.user_limits add column if not exists premium_note text;

-- Yönetici hesapları (e-postası doğrulanmış kayıtlı hesaplar). Yönetici yapmak için ADMIN_EMAILS ortam
-- değişkeni de kullanılabilir; bu ekleme idempotenttir.
insert into public.admins (user_id)
select id from auth.users
where lower(email) in ('info@secesta.com', 'secestasoftware@gmail.com')
on conflict do nothing;

-- Kullanıcı ve özellik (kind) bazında yapay zekâ çağrı sayıları (başarılı, önbelleksiz).
create or replace function public.admin_usage_by_user_kind(days integer default 30)
returns table (user_id uuid, kind text, calls bigint, calls_today bigint)
language sql
security definer
set search_path = public
as $$
  select user_id, kind,
         count(*) filter (where status = 'ok' and not cached) as calls,
         count(*) filter (where status = 'ok' and not cached and created_at >= date_trunc('day', now())) as calls_today
  from ai_usage
  where user_id is not null and created_at > now() - make_interval(days => days)
  group by 1, 2;
$$;
revoke all on function public.admin_usage_by_user_kind(integer) from public, anon, authenticated;
grant execute on function public.admin_usage_by_user_kind(integer) to service_role;

-- Kullanıcı başına kayıt sayıları (yalnızca sayaç; içerik döndürülmez).
create or replace function public.admin_activity_counts()
returns table (user_id uuid, foods bigint, waters bigint, activities bigint, dailies bigint, measurements bigint, supplement_logs bigint, fasting bigint, plans bigint, pantry bigint)
language sql
security definer
set search_path = public
as $$
  select p.id,
         coalesce(f.c, 0), coalesce(w.c, 0), coalesce(a.c, 0), coalesce(d.c, 0), coalesce(m.c, 0),
         coalesce(s.c, 0), coalesce(fs.c, 0), coalesce(mp.c, 0), coalesce(pa.c, 0)
  from profiles p
  left join (select user_id, count(*) c from food_entries group by 1) f on f.user_id = p.id
  left join (select user_id, count(*) c from water_logs group by 1) w on w.user_id = p.id
  left join (select user_id, count(*) c from activities group by 1) a on a.user_id = p.id
  left join (select user_id, count(*) c from daily_logs group by 1) d on d.user_id = p.id
  left join (select user_id, count(*) c from body_measurements group by 1) m on m.user_id = p.id
  left join (select user_id, count(*) c from supplement_logs group by 1) s on s.user_id = p.id
  left join (select user_id, count(*) c from fasting_sessions group by 1) fs on fs.user_id = p.id
  left join (select user_id, count(*) c from meal_plans group by 1) mp on mp.user_id = p.id
  left join (select user_id, count(*) c from pantry_items group by 1) pa on pa.user_id = p.id;
$$;
revoke all on function public.admin_activity_counts() from public, anon, authenticated;
grant execute on function public.admin_activity_counts() to service_role;
