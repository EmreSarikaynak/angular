-- BKNY: envanterde içecek (alkollü dahil) ve takviye ürünleri de tutulur.
-- Alkollü ürünler ve takviyeler yemek önerilerinde ASLA kullanılmaz; yalnızca listede görünür.
alter table public.pantry_items
  add column category text not null default 'food' check (category in ('food', 'drink', 'alcohol', 'supplement')),
  add column volume_ml integer check (volume_ml is null or volume_ml between 1 and 5000),
  add column abv numeric(4, 1) check (abv is null or abv between 0 and 100),
  -- Bir servis/şişe için tahmini kalori (alkollüde saf alkol 7 kcal/g dahil)
  add column kcal integer check (kcal is null or kcal between 0 and 5000);
