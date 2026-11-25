-- Yönetici ekle: kuzgunkync@gmail.com (hesap kayıtlıysa). Idempotent; hesap henüz yoksa hiçbir şey eklemez.
insert into public.admins (user_id)
select id from auth.users
where lower(email) = 'kuzgunkync@gmail.com'
on conflict do nothing;
