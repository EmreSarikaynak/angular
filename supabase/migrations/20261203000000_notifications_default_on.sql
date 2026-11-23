-- BKNY: bildirim türleri herkes için varsayılan olarak AÇIK (yeni ve mevcut kullanıcılar).
-- Bildirim yalnızca bildirim izni verip cihazını kaydeden kullanıcılara gider; bu ayar kimseye izinsiz bildirim göndermez.
-- Ramazan modu bilerek varsayılan KAPALI kalır (yalnızca Ramazan'da kullanıcıya sorulur).
alter table public.profiles alter column reminder_enabled set default true;

update public.profiles
set reminder_enabled = true,
    notify_supplements = true,
    notify_protein = true,
    notify_insights = true,
    notify_evening = true,
    notify_summary = true;
