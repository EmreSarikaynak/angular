-- BKNY: Ramazan ayı geldiğinde sorulan "Oruç tutuyor musun?" sorusunun yanıtı.
-- Değer, yanıtlanan Ramazan'ın başlangıç tarihidir (örn. 2027-02-08); aynı Ramazan'da bir daha sorulmaz.
-- Ramazan modu varsayılan olarak kapalıdır (ramadan_mode default false).
alter table public.profiles
  add column ramadan_answered text check (ramadan_answered is null or ramadan_answered ~ '^\d{4}-\d{2}-\d{2}$');
