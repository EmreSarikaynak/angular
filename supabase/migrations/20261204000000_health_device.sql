-- BKNY: saat ve telefon sağlık uygulamasından (Apple Sağlık / Health Connect) okunan halka kayıtları.
-- source = 'device' olan kayıtlar eşitlemeyle güncellenir; kullanıcı elle düzenlerse 'manual' olur ve bir daha ezilmez.
alter table public.health_rings drop constraint if exists health_rings_source_check;
alter table public.health_rings add constraint health_rings_source_check check (source in ('manual', 'screenshot', 'device'));
