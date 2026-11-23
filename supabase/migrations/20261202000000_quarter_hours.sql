-- BKNY: bildirim saatleri 15 dakikalık adımlarla ayarlanabilir (19:00, 19:15, 19:30, 19:45 ...).
-- Mevcut saat sütunları korunur; dakika kısmı ayrı sütunlarda tutulur (varsayılan 0 = eski davranış).
alter table public.profiles
  add column reminder_start_minute smallint not null default 0 check (reminder_start_minute in (0, 15, 30, 45)),
  add column reminder_end_minute smallint not null default 0 check (reminder_end_minute in (0, 15, 30, 45)),
  add column protein_check_minute smallint not null default 0 check (protein_check_minute in (0, 15, 30, 45)),
  add column evening_minute smallint not null default 0 check (evening_minute in (0, 15, 30, 45));

-- Su hatırlatma aralığı da 15 dakikanın katları olabilir (en az 15 dakika).
alter table public.profiles drop constraint if exists profiles_reminder_interval_min_check;
alter table public.profiles
  add constraint profiles_reminder_interval_min_check check (reminder_interval_min between 15 and 480 and reminder_interval_min % 15 = 0);
