-- BKNY: günlük lif hedefi (g). Varsayılan 25 g (DSÖ/EFSA'nın yetişkinler için genel önerisi); "Yeniden hesapla" kaloriye
-- ve cinsiyete göre 25–38 g arasında önerir. Lif alımı yediklerinizden (yemek kayıtlarındaki lif değerinden) otomatik izlenir.
alter table public.profiles
  add column fiber_target_g integer not null default 25 check (fiber_target_g between 5 and 100);
