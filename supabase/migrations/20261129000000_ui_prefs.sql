-- BKNY: kullanıcının "Kayıt ekle" ekranındaki seçeneklerin sırası ve gizlenenler (cihazlar arası eşitlenir).
-- Biçim: { "<liste anahtarı>": { "order": ["id", ...], "hidden": ["id", ...] } }
alter table public.profiles
  add column ui_prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(ui_prefs) = 'object');
