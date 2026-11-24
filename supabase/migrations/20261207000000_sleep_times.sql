-- Uyku: yatış ve kalkış saati (HH:MM). Süre mevcut sleep_hours alanında kalır.
alter table public.daily_logs
  add column if not exists sleep_bedtime text check (sleep_bedtime is null or sleep_bedtime ~ '^\d{2}:\d{2}$'),
  add column if not exists sleep_waketime text check (sleep_waketime is null or sleep_waketime ~ '^\d{2}:\d{2}$');
