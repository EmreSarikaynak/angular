import type { Nutrients } from "../types";

/**
 * Referans besin tablosu — 100 g yenebilir kısım başına değerler.
 *
 * Değerler USDA FoodData Central ve TürKomp (Ulusal Gıda Kompozisyon Veri Tabanı)
 * yayınlarındaki tipik değerler esas alınarak derlenmiş, yuvarlanmış ortalamalardır.
 * Ev yemeklerinde tarif farkı (yağ miktarı vb.) nedeniyle gerçek değer sapabilir;
 * bu nedenle arayüzde kullanıcı tüm değerleri düzenleyebilir.
 *
 * Sütunlar: anahtar, Türkçe ad, İngilizce ad, kcal, protein, karbonhidrat, yağ, şeker, lif, tuz (g)
 */
type Row = [string, string, string, number, number, number, number, number, number, number];

const ROWS: Row[] = [
  // Tahıllar, ekmek, hamur işleri
  ["rice_pilaf", "Pirinç pilavı (yağlı)", "Rice pilaf (with butter/oil)", 165, 2.9, 30, 3.8, 0.1, 0.5, 0.6],
  ["rice_boiled", "Haşlanmış pirinç", "Boiled white rice", 130, 2.7, 28.2, 0.3, 0.1, 0.4, 0.01],
  ["bulgur_pilaf", "Bulgur pilavı", "Bulgur pilaf", 140, 3.6, 24, 3.4, 0.8, 4, 0.6],
  ["pasta_cooked", "Makarna (haşlanmış)", "Cooked pasta", 158, 5.8, 30.9, 0.9, 0.6, 1.8, 0.01],
  ["bread_white", "Beyaz ekmek", "White bread", 265, 9, 49, 3.2, 5, 2.7, 1.2],
  ["bread_wholewheat", "Tam buğday ekmeği", "Whole wheat bread", 247, 13, 41, 3.4, 6, 7, 1.1],
  ["lavash", "Lavaş", "Lavash flatbread", 275, 9, 56, 1.2, 1.5, 2.4, 1.2],
  ["pide_bread", "Pide ekmeği", "Turkish pide bread", 270, 9, 54, 1.8, 2, 2.5, 1.2],
  ["simit", "Simit", "Simit (sesame bagel)", 300, 9.5, 54, 5.5, 6, 3.5, 1.3],
  ["pogaca", "Poğaça", "Pogaca (savory pastry)", 380, 8, 42, 20, 3, 1.6, 1.3],
  ["borek_cheese", "Peynirli börek", "Cheese borek", 300, 10, 28, 16.5, 1.5, 1.2, 1.4],
  ["borek_meat", "Kıymalı börek", "Minced meat borek", 310, 11, 27, 17.5, 1.5, 1.3, 1.3],
  ["gozleme", "Gözleme (peynirli)", "Gozleme (cheese)", 265, 9.5, 33, 10.5, 1.5, 1.6, 1.3],
  ["lahmacun", "Lahmacun", "Lahmacun", 225, 10.5, 28, 8, 2, 2, 1.1],
  ["pide_minced", "Kıymalı pide", "Minced meat pide", 255, 12, 30, 9.5, 2, 1.6, 1.2],
  ["pide_cheese", "Kaşarlı pide", "Cheese pide", 275, 12, 31, 11.5, 1.5, 1.4, 1.3],
  ["pizza", "Pizza (karışık)", "Pizza (mixed)", 266, 11, 33, 10, 3.6, 2.3, 1.5],
  ["oats", "Yulaf ezmesi (kuru)", "Rolled oats (dry)", 379, 13.2, 67.7, 6.5, 1, 10.1, 0.01],
  ["corn_flakes", "Mısır gevreği", "Corn flakes", 357, 7.5, 84, 0.4, 10, 3.3, 1.8],
  ["manti", "Mantı (yoğurtlu)", "Manti with yogurt", 190, 8, 24, 7, 2, 1.2, 0.9],
  ["french_fries", "Patates kızartması", "French fries", 312, 3.4, 41, 15, 0.3, 3.8, 0.5],
  ["potato_boiled", "Haşlanmış patates", "Boiled potato", 87, 1.9, 20.1, 0.1, 0.9, 1.8, 0.01],
  ["potato_mashed", "Patates püresi", "Mashed potato", 113, 2, 16.9, 4.2, 1.4, 1.5, 0.8],
  // Et, tavuk, balık
  ["chicken_breast_grilled", "Tavuk göğsü (ızgara)", "Grilled chicken breast", 165, 31, 0, 3.6, 0, 0, 0.19],
  ["chicken_thigh", "Tavuk but (pişmiş)", "Chicken thigh (cooked)", 209, 26, 0, 10.9, 0, 0, 0.22],
  ["chicken_doner", "Tavuk döner", "Chicken doner", 195, 24, 2, 10, 0.5, 0.2, 1.2],
  ["chicken_wings", "Tavuk kanat (ızgara)", "Grilled chicken wings", 254, 24, 0, 17, 0, 0, 0.9],
  ["chicken_saute", "Tavuk sote", "Chicken saute with vegetables", 130, 15, 4, 6, 2, 1, 0.8],
  ["chicken_schnitzel", "Tavuk şinitzel", "Chicken schnitzel", 260, 18, 15, 14, 0.8, 0.8, 1.1],
  ["doner_meat", "Et döner", "Beef/lamb doner", 265, 20, 2, 20, 0.5, 0.2, 1.3],
  ["adana_kebab", "Adana kebap", "Adana kebab", 290, 17, 1.5, 24, 0.5, 0.4, 1.4],
  ["urfa_kebab", "Urfa kebap", "Urfa kebab", 285, 17, 1.5, 23.5, 0.5, 0.4, 1.3],
  ["kofte_grilled", "Izgara köfte", "Grilled meatballs (kofte)", 245, 18, 6, 16.5, 0.8, 0.6, 1.3],
  ["shish_lamb", "Kuzu şiş", "Lamb shish kebab", 235, 24, 0, 15, 0, 0, 0.8],
  ["shish_chicken", "Tavuk şiş", "Chicken shish kebab", 170, 27, 1, 6, 0.5, 0, 0.8],
  ["iskender", "İskender kebap", "Iskender kebab", 215, 12, 13, 13, 2, 0.8, 1.0],
  ["beef_steak", "Dana biftek (ızgara)", "Grilled beef steak", 250, 27, 0, 15.5, 0, 0, 0.15],
  ["beef_minced_cooked", "Dana kıyma (pişmiş)", "Cooked minced beef", 254, 26, 0, 16.5, 0, 0, 0.2],
  ["lamb_chop", "Kuzu pirzola", "Lamb chop", 294, 25, 0, 21, 0, 0, 0.2],
  ["meat_stew", "Etli güveç / tas kebabı", "Meat stew", 150, 13, 5, 8.5, 2, 1, 0.8],
  ["sucuk", "Sucuk", "Sucuk (Turkish sausage)", 450, 21, 1.5, 40, 0.5, 0, 3.3],
  ["pastirma", "Pastırma", "Pastirma (cured beef)", 250, 31, 1, 13.5, 0, 0, 5],
  ["sausage", "Sosis", "Sausage", 290, 12, 3, 26, 1, 0, 2.2],
  ["hamburger", "Hamburger", "Hamburger", 255, 13, 26, 11, 5, 1.3, 1.2],
  ["salmon", "Somon (ızgara)", "Grilled salmon", 206, 22, 0, 12.5, 0, 0, 0.15],
  ["sea_bass", "Levrek (ızgara)", "Grilled sea bass", 124, 23.6, 0, 2.6, 0, 0, 0.2],
  ["sea_bream", "Çipura (ızgara)", "Grilled sea bream", 135, 24, 0, 4, 0, 0, 0.2],
  ["anchovy_fried", "Hamsi tava", "Fried anchovies", 240, 21, 8, 13.5, 0, 0.3, 0.9],
  ["tuna_canned", "Ton balığı (konserve, süzülmüş)", "Canned tuna (drained)", 160, 26, 0, 6, 0, 0, 0.9],
  ["shrimp", "Karides (pişmiş)", "Cooked shrimp", 99, 24, 0.2, 0.3, 0, 0, 0.3],
  // Yumurta, süt ürünleri
  ["egg_boiled", "Haşlanmış yumurta", "Boiled egg", 155, 12.6, 1.1, 10.6, 1.1, 0, 0.31],
  ["egg_fried", "Sahanda yumurta", "Fried egg", 196, 13.6, 0.8, 15, 0.4, 0, 0.5],
  ["omelette", "Omlet", "Omelette", 154, 10.6, 0.7, 12, 0.4, 0, 0.6],
  ["menemen", "Menemen", "Menemen (eggs with tomato & pepper)", 105, 5.5, 4.5, 7.5, 3, 1, 0.7],
  ["white_cheese", "Beyaz peynir (tam yağlı)", "Feta-style white cheese", 265, 15, 2.5, 21.5, 2, 0, 2.8],
  ["kashar", "Kaşar peyniri", "Kashar cheese", 350, 25, 2, 27, 0.5, 0, 1.8],
  ["lor", "Lor peyniri", "Lor (curd cheese)", 98, 13, 3, 4, 3, 0, 0.3],
  ["cottage_cheese", "Süzme peynir / cottage", "Cottage cheese", 98, 11, 3.4, 4.3, 2.7, 0, 0.9],
  ["tulum", "Tulum peyniri", "Tulum cheese", 365, 23, 2, 29.5, 0.5, 0, 3],
  ["yogurt", "Yoğurt (tam yağlı)", "Whole milk yogurt", 61, 3.5, 4.7, 3.3, 4.7, 0, 0.12],
  ["yogurt_strained", "Süzme yoğurt", "Strained (Greek) yogurt", 97, 9, 4, 5, 4, 0, 0.1],
  ["cacik", "Cacık", "Cacik (yogurt with cucumber)", 45, 2.6, 3.8, 2.2, 3.5, 0.3, 0.5],
  ["ayran", "Ayran", "Ayran", 37, 1.9, 2.6, 1.9, 2.6, 0, 0.5],
  ["milk_whole", "Süt (tam yağlı)", "Whole milk", 61, 3.2, 4.8, 3.3, 4.8, 0, 0.1],
  ["milk_semi", "Süt (yarım yağlı)", "Semi-skimmed milk", 47, 3.3, 4.8, 1.6, 4.8, 0, 0.1],
  ["butter", "Tereyağı", "Butter", 717, 0.9, 0.1, 81, 0.1, 0, 0.03],
  ["kaymak", "Kaymak", "Clotted cream (kaymak)", 480, 2.5, 3, 51, 3, 0, 0.1],
  // Çorbalar
  ["lentil_soup", "Mercimek çorbası", "Red lentil soup", 62, 3.5, 9, 1.4, 1, 1.8, 0.7],
  ["ezogelin_soup", "Ezogelin çorbası", "Ezogelin soup", 60, 3, 9.5, 1.3, 1.2, 1.6, 0.7],
  ["tarhana_soup", "Tarhana çorbası", "Tarhana soup", 52, 2, 8.5, 1.2, 1.2, 0.8, 0.8],
  ["yayla_soup", "Yayla çorbası", "Yogurt soup (yayla)", 55, 2.4, 6.5, 2.2, 1.5, 0.2, 0.7],
  ["chicken_soup", "Tavuk suyu çorba", "Chicken soup", 45, 3.5, 4.5, 1.5, 0.5, 0.3, 0.8],
  ["tomato_soup", "Domates çorbası", "Tomato soup", 50, 1.2, 7, 2, 3.5, 0.8, 0.8],
  ["iskembe_soup", "İşkembe çorbası", "Tripe soup", 55, 5, 3, 2.6, 0.3, 0, 0.8],
  // Sebze yemekleri, zeytinyağlılar, baklagiller
  ["kuru_fasulye", "Kuru fasulye (yemek)", "White bean stew", 115, 6.5, 14.5, 3.4, 1.5, 4.5, 0.7],
  ["nohut", "Nohut yemeği", "Chickpea stew", 130, 6.8, 16, 4.2, 2.5, 4.5, 0.7],
  ["green_lentil", "Yeşil mercimek yemeği", "Green lentil stew", 105, 6.5, 14, 2.5, 1.2, 4.5, 0.6],
  ["barbunya", "Barbunya pilaki", "Borlotti beans in olive oil", 120, 5.5, 15, 4.2, 2.5, 4.5, 0.6],
  ["taze_fasulye", "Zeytinyağlı taze fasulye", "Green beans in olive oil", 70, 1.6, 6.5, 4.3, 3, 2.8, 0.6],
  ["karniyarik", "Karnıyarık", "Karniyarik (stuffed eggplant)", 135, 5.5, 6.5, 10, 3.5, 2.5, 0.7],
  ["imam_bayildi", "İmam bayıldı", "Imam bayildi", 110, 1.3, 7.5, 8.5, 4, 2.8, 0.6],
  ["musakka", "Musakka", "Moussaka", 125, 5.5, 7, 8.5, 3.5, 2.2, 0.7],
  ["dolma_pepper", "Biber dolması (etli)", "Stuffed peppers (meat)", 115, 5, 12, 5.2, 2.5, 1.5, 0.7],
  ["sarma_olive_oil", "Zeytinyağlı yaprak sarma", "Stuffed vine leaves (olive oil)", 165, 2.6, 22, 7.5, 2.5, 2.5, 0.9],
  ["spinach_dish", "Ispanak yemeği", "Spinach stew", 65, 3, 5, 3.8, 1, 2.2, 0.6],
  ["turlu", "Türlü", "Mixed vegetable stew", 75, 2.5, 7, 4.2, 3.5, 2.5, 0.6],
  ["kisir", "Kısır", "Kisir (bulgur salad)", 160, 3.5, 24, 5.8, 2.5, 4, 0.8],
  ["mercimek_kofte", "Mercimek köftesi", "Lentil patties", 170, 6.5, 26, 4.5, 1.5, 4.5, 0.8],
  ["cig_kofte", "Çiğ köfte (etsiz)", "Cig kofte (vegan)", 180, 5, 31, 4, 3, 5.5, 1.3],
  ["hummus", "Humus", "Hummus", 177, 7.9, 14.3, 9.6, 0.3, 6, 0.9],
  ["falafel", "Falafel", "Falafel", 333, 13.3, 31.8, 17.8, 3, 5, 0.7],
  ["mucver", "Mücver", "Zucchini fritters", 190, 5.5, 14, 12.5, 2, 1.5, 0.8],
  ["shepherd_salad", "Çoban salata", "Shepherd's salad", 55, 1, 4.5, 3.8, 3, 1.3, 0.4],
  ["green_salad", "Yeşil salata (yağsız)", "Green salad (no dressing)", 17, 1.3, 3, 0.2, 1.5, 1.5, 0.03],
  ["green_salad_oil", "Mevsim salata (zeytinyağlı)", "Mixed salad with olive oil", 60, 1.2, 4, 4.5, 2.5, 1.5, 0.3],
  ["olive_black", "Siyah zeytin", "Black olives", 185, 1.4, 4, 18.5, 0, 3, 3],
  ["olive_green", "Yeşil zeytin", "Green olives", 145, 1, 3.8, 15.3, 0.5, 3.3, 3.5],
  ["olive_oil", "Zeytinyağı", "Olive oil", 884, 0, 0, 100, 0, 0, 0],
  ["tomato", "Domates", "Tomato", 18, 0.9, 3.9, 0.2, 2.6, 1.2, 0.01],
  ["cucumber", "Salatalık", "Cucumber", 15, 0.7, 3.6, 0.1, 1.7, 0.5, 0],
  ["pepper_green", "Yeşil biber", "Green pepper", 20, 0.9, 4.6, 0.2, 2.4, 1.7, 0],
  ["carrot", "Havuç", "Carrot", 41, 0.9, 9.6, 0.2, 4.7, 2.8, 0.17],
  ["broccoli", "Brokoli (haşlanmış)", "Boiled broccoli", 35, 2.4, 7.2, 0.4, 1.4, 3.3, 0.1],
  ["avocado", "Avokado", "Avocado", 160, 2, 8.5, 14.7, 0.7, 6.7, 0.02],
  ["corn_boiled", "Haşlanmış mısır", "Boiled corn", 96, 3.4, 21, 1.5, 4.5, 2.4, 0],
  // Meyveler
  ["apple", "Elma", "Apple", 52, 0.3, 13.8, 0.2, 10.4, 2.4, 0],
  ["banana", "Muz", "Banana", 89, 1.1, 22.8, 0.3, 12.2, 2.6, 0],
  ["orange", "Portakal", "Orange", 47, 0.9, 11.8, 0.1, 9.4, 2.4, 0],
  ["mandarin", "Mandalina", "Mandarin", 53, 0.8, 13.3, 0.3, 10.6, 1.8, 0],
  ["grape", "Üzüm", "Grapes", 69, 0.7, 18.1, 0.2, 15.5, 0.9, 0],
  ["strawberry", "Çilek", "Strawberry", 32, 0.7, 7.7, 0.3, 4.9, 2, 0],
  ["watermelon", "Karpuz", "Watermelon", 30, 0.6, 7.6, 0.2, 6.2, 0.4, 0],
  ["melon", "Kavun", "Melon", 34, 0.8, 8.2, 0.2, 7.9, 0.9, 0.04],
  ["peach", "Şeftali", "Peach", 39, 0.9, 9.5, 0.3, 8.4, 1.5, 0],
  ["pear", "Armut", "Pear", 57, 0.4, 15.2, 0.1, 9.8, 3.1, 0],
  ["cherry", "Kiraz", "Cherries", 63, 1.1, 16, 0.2, 12.8, 2.1, 0],
  ["apricot", "Kayısı", "Apricot", 48, 1.4, 11.1, 0.4, 9.2, 2, 0],
  ["fig", "İncir (taze)", "Fresh fig", 74, 0.8, 19.2, 0.3, 16.3, 2.9, 0],
  ["pomegranate", "Nar", "Pomegranate", 83, 1.7, 18.7, 1.2, 13.7, 4, 0],
  ["kiwi", "Kivi", "Kiwi", 61, 1.1, 14.7, 0.5, 9, 3, 0],
  ["dates", "Hurma", "Dates", 282, 2.5, 75, 0.4, 63.4, 8, 0],
  ["dried_apricot", "Kuru kayısı", "Dried apricots", 241, 3.4, 62.6, 0.5, 53.4, 7.3, 0.03],
  ["raisins", "Kuru üzüm", "Raisins", 299, 3.1, 79.2, 0.5, 59.2, 3.7, 0.03],
  // Kuruyemiş
  ["walnut", "Ceviz", "Walnuts", 654, 15.2, 13.7, 65.2, 2.6, 6.7, 0],
  ["hazelnut", "Fındık", "Hazelnuts", 628, 15, 16.7, 60.8, 4.3, 9.7, 0],
  ["almond", "Badem", "Almonds", 579, 21.2, 21.6, 49.9, 4.4, 12.5, 0],
  ["pistachio", "Antep fıstığı", "Pistachios", 560, 20.2, 27.2, 45.3, 7.7, 10.6, 0],
  ["peanut", "Yer fıstığı", "Peanuts", 567, 25.8, 16.1, 49.2, 4.7, 8.5, 0.05],
  ["sunflower_seeds", "Ay çekirdeği (içi)", "Sunflower seed kernels", 584, 20.8, 20, 51.5, 2.6, 8.6, 0.02],
  ["peanut_butter", "Fıstık ezmesi", "Peanut butter", 588, 25, 20, 50, 9, 6, 1.1],
  ["tahini", "Tahin", "Tahini", 595, 17, 21, 54, 0.5, 9.3, 0.1],
  // Tatlılar, atıştırmalıklar
  ["baklava", "Baklava", "Baklava", 430, 6.5, 50, 23, 30, 2, 0.4],
  ["kunefe", "Künefe", "Kunefe", 370, 7.5, 44, 18.5, 26, 0.8, 0.5],
  ["sutlac", "Sütlaç", "Rice pudding (sutlac)", 125, 3.2, 22, 2.8, 14, 0.1, 0.1],
  ["kazandibi", "Kazandibi / muhallebi", "Milk pudding (kazandibi)", 150, 3.5, 26, 3.6, 18, 0, 0.1],
  ["revani", "Revani", "Revani (semolina cake)", 330, 4.5, 56, 10, 38, 0.7, 0.3],
  ["lokum", "Lokum", "Turkish delight", 330, 0.2, 82, 0.2, 60, 0, 0.05],
  ["helva_tahini", "Tahin helvası", "Tahini halva", 515, 12, 52, 29, 42, 4, 0.1],
  ["ice_cream", "Dondurma", "Ice cream", 207, 3.5, 23.6, 11, 21, 0.7, 0.2],
  ["chocolate_milk", "Sütlü çikolata", "Milk chocolate", 535, 7.7, 59.4, 29.7, 51.5, 3.4, 0.2],
  ["chocolate_dark", "Bitter çikolata (%70)", "Dark chocolate (70%)", 598, 7.8, 45.9, 42.6, 24, 10.9, 0.05],
  ["cake_plain", "Kek (sade)", "Plain sponge cake", 370, 5.5, 52, 15.5, 30, 1, 0.6],
  ["biscuit", "Bisküvi", "Biscuits", 460, 7, 70, 16.5, 22, 2.5, 0.9],
  ["chips", "Patates cipsi", "Potato chips", 536, 7, 53, 34.6, 0.5, 4.4, 1.3],
  ["honey", "Bal", "Honey", 304, 0.3, 82.4, 0, 82.1, 0.2, 0.01],
  ["jam", "Reçel", "Jam", 260, 0.4, 65, 0.1, 49, 1, 0.05],
  ["pekmez", "Pekmez", "Grape molasses", 290, 0.5, 72, 0.1, 60, 0.3, 0.05],
  ["sugar", "Toz şeker", "Sugar", 387, 0, 100, 0, 100, 0, 0],
  // İçecekler
  ["tea_plain", "Çay (şekersiz)", "Black tea (no sugar)", 1, 0, 0.2, 0, 0, 0, 0],
  ["coffee_black", "Sade kahve", "Black coffee", 1, 0.1, 0, 0, 0, 0, 0],
  ["cola", "Kola", "Cola", 42, 0, 10.6, 0, 10.6, 0, 0.01],
  ["orange_juice", "Portakal suyu", "Orange juice", 45, 0.7, 10.4, 0.2, 8.4, 0.2, 0],
  ["salgam", "Şalgam suyu", "Salgam (fermented turnip juice)", 10, 0.3, 2, 0, 0.5, 0.3, 1.5],
  ["boza", "Boza", "Boza", 90, 1, 20, 0.3, 12, 0.3, 0.02],
];

export interface ReferenceFood {
  key: string;
  tr: string;
  en: string;
  per100: Omit<Nutrients, "alcohol_g">;
}

export const REFERENCE_FOODS: ReferenceFood[] = ROWS.map(([key, tr, en, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, salt_g]) => ({
  key,
  tr,
  en,
  per100: { kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, salt_g },
}));

const BY_KEY = new Map(REFERENCE_FOODS.map((f) => [f.key, f]));

export function referenceFood(key: string | null | undefined): ReferenceFood | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

/** Referans tablosundan verilen gramaj için besin değerleri. */
export function nutrientsFromReference(food: ReferenceFood, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: Math.round(food.per100.kcal * f),
    protein_g: Math.round(food.per100.protein_g * f * 10) / 10,
    carbs_g: Math.round(food.per100.carbs_g * f * 10) / 10,
    fat_g: Math.round(food.per100.fat_g * f * 10) / 10,
    sugar_g: Math.round(food.per100.sugar_g * f * 10) / 10,
    fiber_g: Math.round(food.per100.fiber_g * f * 10) / 10,
    salt_g: Math.round(food.per100.salt_g * f * 100) / 100,
    alcohol_g: 0,
  };
}

/** Gemini istemine eklenen kısa anahtar listesi. */
export function referenceKeyList(): string {
  return REFERENCE_FOODS.map((f) => `${f.key}=${f.tr}`).join("; ");
}
