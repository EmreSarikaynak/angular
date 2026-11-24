-- BKNY: sessiz saatler (bu aralıkta hiçbir bildirim gönderilmez) ve saat dilimini cihazdan otomatik izleme.
-- Varsayılan: sessiz saatler AÇIK, 22:00–08:00 (kullanıcının kendi saat dilimine göre); saat dilimi otomatik.
alter table public.profiles
  add column timezone_auto boolean not null default true,
  add column quiet_enabled boolean not null default true,
  add column quiet_start text not null default '22:00' check (quiet_start ~ '^\d{2}:\d{2}$'),
  add column quiet_end text not null default '08:00' check (quiet_end ~ '^\d{2}:\d{2}$');
