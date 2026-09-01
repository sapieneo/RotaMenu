# Rotamenu — Sistem Kontrol Raporu

**Tarih:** 20 Ağustos 2026
**Yayın:** https://rotamenu.netlify.app · commit `78faf34`
**Veritabanı:** Supabase `vaqhdaaqdsgfajqdvzls`

---

## 1. Özet

Sistem ayakta ve çalışıyor. Yayındaki 5 işletme menüsünün hepsi açılıyor, fiyatlar
doğru biçimde, çoklu menü canlıda çalışıyor. Kod tarafında kritik bir sorun yok.

Bulunan sorunların tamamı **veri/işletim** kaynaklı, biri de **güvenlik**:
kaynak kodu deposu hâlâ herkese açık.

Öncelik sırası:

| # | Sorun | Etki | Tür |
|---|---|---|---|
| 1 | `sapieneo/RestaurantOS` deposu hâlâ **Public** | Kaynak kod herkese açık | Güvenlik |
| 2 | Çiçek Lokanta: 28 kategoriden 20'si hiç çevrilmemiş | Yabancı misafir menünün %68'ini Türkçe görüyor | Veri |
| 3 | Amigos "Kokteyl" menüsü: çeviri yok + alerjen onayı yok | 10 ürün | Veri |
| 4 | Meltem Farsça çevirisi yarım (75/99) ve iş **failed** | Misafire yarım dil sunuluyor | Hata |
| 5 | Konya Nergiz yayında ama içeriği eksik | 91 üründen 81'inde açıklama, 25'inde fiyat yok | Veri |
| 6 | "+ Sayfa ekle" zaman aşımı hâlâ açık | Büyük menülerde çalışmıyor | Kod |
| 7 | Hiçbir işletmede ★ Şefin Seçtikleri işaretli değil | Şerit otomatik seçimle doluyor | Veri |

---

## 2. Deploy ve altyapı

| Kontrol | Sonuç |
|---|---|
| Netlify deploy | ✅ `ready` — commit `78faf34`, 68 sn, 15:30'da yayınlandı |
| Fonksiyonlar | ✅ 3 fonksiyon + 1 edge fonksiyon (`menu-ingest-background`, `menu-translate-background`, Next.js handler) |
| Secret taraması | ✅ 207 dosya tarandı, 0 eşleşme |
| Yerel build | ✅ `next build` temiz — tip kontrolü ve lint dahil |
| Netlify env değişkenleri | ⚠️ Doğrulanamadı — Netlify API bu turda 502/timeout verdi. Site çalıştığı için değişkenler yerinde, ama liste teyit edilmedi |

**Not:** `git push` sırasında GitHub "This repository moved, use
`https://github.com/sapieneo/RotaMenu.git`" uyarısı veriyor. Remote adresi
`Rotamenu` (küçük m) yazımında kalmış. Çalışıyor ama düzeltilmeli:

```powershell
git remote set-url origin https://github.com/sapieneo/RotaMenu.git
```

---

## 3. Veritabanı durumu

| İşletme | Slug | Yayın | Menü | Kategori | Ürün | Fiyatsız | Açıklamasız | Alerjen bekleyen |
|---|---|---|---|---|---|---|---|---|
| Çiçek Lokanta | `cicek-lokantasi` | ✅ | 1 | 28 | 168 | 4 | 0 | 0 |
| Avana | `avana` | ✗ | 1 | 10 | 109 | 1 | 60 | 109 |
| Meltem Lokantası | `isletme-44q4s5ce` | ✅ | 1 | 10 | 99 | 0 | 0 | 0 |
| Konya Nergiz | `konya-nergiz` | ✅ | 1 | 10 | 91 | **25** | **81** | 0 |
| Amigos | `amigos` | ✅ | **2** | 9 | 50 | 3 | 0 | **10** |
| Tencere Lokantası | `tencere` | ✗ | 1 | 4 | 43 | 6 | 35 | 16 |
| İspir Fırın | `ispir-firin` | ✗ | 1 | 1 | 17 | 0 | 17 | 0 |
| Sofra Lokantası | `demo` | ✅ | 1 | 5 | 15 | 0 | 0 | 0 |
| Pizza Tinto | `dnm2` | ✗ | 1 | 3 | 13 | 0 | 0 | 13 |
| The Local Pub | `isletme-2mp6p3m8` | ✗ | 1 | 2 | 10 | 0 | 0 | 0 |

Ayrıca **6 adet boş "İşletmem" kaydı** var (menüsüz, ürünsüz, yayında değil) —
test artığı görünüyor, temizlenebilir.

**Bütünlük kontrolleri — hepsi temiz:**

- Boş menü (kategorisi/ürünü olmayan) yok
- `raw_result` içindeki menü kimliklerinin hiçbiri bayat değil — hepsi var olan
  menülere işaret ediyor (bu sabah eklediğim doğrulamanın tetikleneceği bir durum yok)
- Yayındaki hiçbir işletmede alerjen onayı bekleyen ürün yok (Amigos hariç, aşağıda)

---

## 4. Canlı menü kontrolleri

| Sayfa | Sonuç |
|---|---|
| `/m/amigos` | ✅ Açılıyor · fiyatlar **TL** · "🌮 Mexican Menu" ve "🍸 Kokteyl" sekmeleri çalışıyor |
| `/m/cicek-lokantasi` | ✅ Açılıyor · **TL** · 28 kategori · dil anahtarı TR/RU/AR/EN |
| `/m/konya-nergiz` | ✅ Açılıyor · **TL** · dil anahtarı yok (çeviri yok — beklenen) |
| `/m/cicek-lokantasi?lang=en` | ⚠️ İlk 8 kategori İngilizce, kalan 20'si Türkçe |
| `/m/amigos?lang=en` | ⚠️ Mexican Menu İngilizce, Kokteyl menüsü çevrilmemiş |
| Ana sayfa `/` | ✅ Marka **Rotamenu** · fiyatlandırma bölümü yok |

**₺ → TL değişimi canlıda doğrulandı** — kontrol edilen tüm menülerde
"280 TL", "1250 TL" biçiminde. Hiç `₺` kalmamış.

**Ana sayfada küçük bir artık:** üst çubukta hâlâ **"Ücretsiz dene"** CTA'sı var.
Ajans modunda ücretli plan olmadığı için "ücretsiz" vurgusu anlamsız — muhtemelen
"Menünüzü kuralım" gibi bir şey olmalı.

---

## 5. Çeviri durumu — teşhis edildi

Bu, açık işler listesindeki 3. ve 4. maddelerin gerçek sebebi. **Kod hatası değil,
işletim sırası sorunu:** çeviri çalıştırıldıktan SONRA menüye yeni sayfa yüklenmiş,
çeviri bir daha çalıştırılmamış. Çeviri işi "completed" göründüğü için de arayüzde
her şey yolunda sanılıyor.

| İşletme | Dil | Çevrilen ürün | İş durumu | Tarih |
|---|---|---|---|---|
| Çiçek Lokanta | en / ar / ru | **53 / 168** | completed | 2 Ağu |
| Meltem | ru | 99 / 99 | completed | 5 Ağu |
| Meltem | fa | **75 / 99** | **failed** | 5 Ağu |
| Amigos | en | **40 / 50** | completed (yalnız "Mexican Menu") | 19 Ağu |
| Pizza Tinto | ar / de / el | 13 / 13 | completed | 13 Ağu |

**Çiçek Lokanta'da kesme noktası tam olarak şurası:** `sort_order` 0–7 arası
kategoriler (ilk yükleme) çevrilmiş, 8–27 arası (sonradan yüklenen içecek /
kokteyl / şarap sayfaları) hiç çevrilmemiş. Üç dilde de aynı yerde kesiliyor,
yani çeviri motorunda bir sorun yok — o kategoriler var olduğunda çeviri
çalıştırılmamış.

**Amigos'ta:** çeviri işi yalnız "Mexican Menu" için var. "Kokteyl" menüsü elle
oluşturulduğu için hiç iş kaydı yok → 10 ürün çevrilmemiş.

**Meltem Farsça'da gerçek bir davranış hatası var:** iş `failed` durumda ama
75 ürün çevrilmiş. Misafir menüsü "çevirisi olan dil" olarak Farsça'yı gösteriyor,
misafir seçince menünün dörtte biri Türkçe kalıyor. Başarısız iş ya temizlenmeli
ya da dil listesine çıkmamalı.

### Yapılacaklar

1. Stüdyo → Diller'den **Çiçek Lokanta** için en/ar/ru çevirisini yeniden çalıştır
2. **Amigos** için en çevirisini yeniden çalıştır (Kokteyl menüsü dahil olmalı)
3. **Meltem** Farsça'yı ya tamamla ya da kaldır

---

## 6. Alerjen / uyum durumu

Yayındaki işletmelerde tek eksik **Amigos**: 10 üründe alerjen ve kalori onayı
bekliyor. Bunlar elle oluşturulan "Kokteyl" menüsündeki ürünler — onay akışından
hiç geçmemişler. Misafir menüsü onaysız alerjenleri göstermediği için bu ürünlerde
"⚠ Alerjen bilgisi doğrulanmadı" yazıyor.

Yayında olmayan işletmelerde bekleyen onaylar var (Avana 109, Tencere 16,
Pizza Tinto 13) ama yayında olmadıkları için misafiri etkilemiyor.

**Şefin Seçtikleri:** 615 ürünün **hiçbirinde** ★ işareti yok. Şerit her işletmede
otomatik seçimle doluyor (kod böyle tasarlandı, hata değil) — ama elle seçim
yapılırsa çok daha iyi görünür.

---

## 7. Güvenlik

**🔴 Acil: `github.com/sapieneo/RestaurantOS` hâlâ Public.**
İçe aktarma için geçici olarak açılmış ve bir daha kapatılmamış. Şu anda tam
kaynak kodu (README dahil) herkese açık. GitHub → Settings → Danger Zone →
Change visibility → Private.

`sapieneo/RotaMenu` deposu doğru şekilde private (Netlify `public_repo: false`
diyor).

**Supabase advisor sonuçları** — kritik bir şey yok:

- `platform_settings` ve `setup_requests` tablolarında RLS açık ama policy yok
  → yani kimse erişemiyor. Yalnız service role üzerinden yazılıyorsa doğru.
- `confirm_item_compliance` ve `unconfirm_item_compliance` fonksiyonları
  `SECURITY DEFINER` ve giriş yapmış kullanıcılara açık — uyum akışı için
  muhtemelen kasıtlı, ama fonksiyonların içinde org kontrolü olduğundan emin ol.
- Sızdırılmış parola koruması (HaveIBeenPwned) kapalı → Supabase Auth
  ayarlarından tek tıkla açılabilir.
- 20+ tabloda "anonim erişime açık policy" uyarısı var; bu QR menü ürünü için
  **beklenen** — misafir giriş yapmadan menüyü okuyabilmeli.

---

## 8. Açık işlerin güncel durumu

| # | Devir özetindeki madde | Durum |
|---|---|---|
| 1 | "+ Sayfa ekle" zaman aşımı | 🔴 **Açık.** `api/menu/extract-pages/route.ts` değişmemiş, OCR hâlâ eşzamanlı. Yalnız anlaşılır hata mesajı var. Kalıcı çözüm arka plan fonksiyonu |
| 2 | Mobil görünüm doğrulanmadı | 🔴 **Hâlâ doğrulanmadı.** Gerçek telefonda `/m/cicek-lokantasi` açılıp bakılmalı |
| 3 | Çiçek çevirisi eksik | 🟡 Teşhis edildi (bkz. §5), düzeltme = çeviriyi yeniden çalıştır |
| 4 | Amigos'ta çeviri yok | 🟡 Kısmen çözülmüş — Mexican Menu 19 Ağu'da çevrilmiş, Kokteyl kalmış |
| 5 | Kategori çipi: kaydırma → filtreleme | ⏸️ Ertelenmiş, karar bekliyor |
| 6 | RestaurantOS deposu private mi? | 🔴 **Hayır, hâlâ public** (bkz. §7) |
| — | Çoklu menü (§3.5) | ✅ **Tamamlandı, yayında ve doğrulandı** |
| — | ₺ → TL | ✅ **Tamamlandı ve canlıda doğrulandı** |
| — | Menü şeridi daralınca açılır menü | ✅ **Tamamlandı ve yayında** |

---

## 9. Bu oturumda düzeltilen kod hataları

1. **Silinmiş menü kimliği = veri kaybı** (`api/ingest/[id]/approve/route.ts`)
   `created_menu_id` / `created_menu_ids` körü körüne yeniden kullanılıyordu.
   Menü silinmişse FK hatası veriyor, onay akışı kategorileri INSERT'ten önce
   sildiği için o yüklemenin tüm kategorileri kayboluyor ve her "Yeniden Kaydet"
   aynı hatayı tekrarlıyordu. Artık kimlikler venue'nün gerçek menü listesine
   karşı doğrulanıyor.

2. **Onaylı çoklu menü taslağı yeniden açılınca kategori kaybı**
   (`studyo/[id]/page.tsx`) `hydrateDraft` kategorileri `menu_id` ile
   süzüyordu; ana menü dışındaki kategoriler taslakta hiç görünmüyor, ardından
   bir "Yeniden Kaydet" onları veritabanından da siliyordu. Artık yalnız
   `ingestion_id` ile süzüyor ve `menu_key`'ler geri çözülüyor.

3. **Gereksiz boş ana menü** — tüm kategoriler ayrı menülere dağıtıldığında
   artık boş ana menü açılmıyor.

4. **Menü listesinde kategori sayacı** (`draft-editor.tsx`) — menüyü kaldırmanın
   kaç kategoriyi ana menüye geri alacağı artık silmeden önce görünüyor.
