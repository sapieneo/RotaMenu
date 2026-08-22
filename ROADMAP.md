# RotaMenu — Yol Haritası

Bu dosya, üzerinde anlaştığımız işlerin sırasını tutar. Tamamlananları işaretleyerek ilerliyoruz.

## Tamamlanan
- **M0** temel: çok kiracılı şema + RLS + 16 alerjen seed.
- **M1** AI çıkarma: fotoğraf/PDF → OpenAI vision → taslak → onayla & kaydet.
- **M2** uyum motoru: alerjen/kalori onay akışı, denetim ekranı, PDF uyum raporu.
- **Deploy**: Supabase projesi (`vaqhdaaqdsgfajqdvzls`) migration'ları uygulandı, anonim giriş açık, kod GitHub'da (`sapieneo/RotaMenu`), yerelde uçtan uca çalışıyor (menü fotoğrafı okundu).

---

## Faz A — Menü editörü + misafir menüsü zenginleştirme (ŞİMDİ)
Menucraft'taki olgunluğu yeni mimariye taşıyoruz. İlke: güçlü ama **temiz ve sade** arayüz; kullanıcıyı bilgiyle boğmadan, gelişmiş alanlar katlanır/opsiyonel.

- **A1 · Para birimi seçimi.** `venues.currency_code` kullanıcı tarafından seçilir (₺, $, €, £, …). Fiyatlar editörde ve misafir menüsünde doğru sembolle gösterilir (ör. `600 ₺`). Zorunlu ₺ yok.
- **A2 · Kalori (porsiyon).** AI porsiyon kalorisi tahmin eder; editörde düzenlenir, M2'de onaylanır; misafirde "KALORİ (PORSİYON)".
- **A3 · İçindekiler.** YENİ `items.ingredients` alanı. AI önerir; misafir detay modalında "İÇİNDEKİLER".
- **A4 · Diyet rozetleri.** Helal, Alkolsüz, Vegan, Vejetaryen (+ ops. acılı). YENİ diyet bayrakları (şema). Uyum ilkesiyle: AI önerir → işletme onaylar → misafir çipi.
- **A5 · Elle ekleme. ✅ TAMAMLANDI.** Editörde elle ürün ekle (var) **ve** kategori ekle ("+ Kategori ekle"); kategori sil.
- **A6 · Sıralama. ✅ TAMAMLANDI.** Ürünleri ve kategorileri ok tuşlarıyla yukarı/aşağı taşı. `sort_order` approve'da dizi sırasından yazılır (şema değişikliği yok). Sıralama/ekleme "Yeniden Kaydet" ile canlıya yansır.
- **Tahribatsız yeniden kaydetme. ✅ TAMAMLANDI.** Approve, silmeden önce mevcut alerjen/diyet/kalori onaylarını (kategori adı + ürün adı) anahtarıyla anımsar ve yeniden oluşturulan ürünlere geri uygular. Sıralama/düzenleme sonrası "Yeniden Kaydet" onayları KORUR; yalnız adı değişen/yeni ürünler tekrar 'pending' olur. Yanıt `restoredCount` döner.
- **A7 · Ürün görseli (AI). ✅ TAMAMLANDI.** `/studyo/gorseller`: Runware ile AI görsel üretimi (FLUX.1 schnell varsayılan), yeniden üret, elle yükle, kaldır. Görsel venue-media'ya kalıcı kaydedilir, `items.image_url` yazılır, misafir menüsünde görünür. `RUNWARE_API_KEY` gerekir. (Ücretli katman gating'i Faz C'de.)
- **A8 · Kategori arka planı.** Kategoriyi temsil eden arka plan görseli (opsiyonel; ücretli katman).
- **A9 · Misafir menüsü (M3). ✅ TAMAMLANDI.** `/m/[slug]` genel menü ekranı: yapışkan kategori sekmeleri (scroll-spy), ürün satırları, detay modalı (içindekiler + alerjen + kalori + rozet + "işletme beyanı" notu), iletişim & bilgi footer'ı (adres, harita, telefon, whatsapp, instagram, çalışma saati, wifi). Uyum ekranından "Misafir menüsünü önizle" linki. Yeni migration: `0007_venue_hours.sql` (venues.opening_hours).

Kabul: taslak editöründe para birimi/kalori/içindekiler/rozet düzenlenip onaylanabiliyor; misafir menüsü örnek ekranlardaki gibi zengin görünüyor; ücretsiz sınırları aşan görsel özellikler kilitli.

## Faz B — Yayın + QR + hesap (M3/M4)
- **İşletme ayarları ekranı. ✅ TAMAMLANDI.** `/studyo/ayarlar`: ad, açıklama, para birimi, adres, harita, telefon, whatsapp, instagram, çalışma saati, wifi düzenleme (PATCH /api/venue, RLS editor). Misafir menüsü footer'ını doldurur. Editör 'kaydedildi' ve uyum ekranlarından erişilir.
- **B1 · Yayınlama akışı. ✅ TAMAMLANDI.** `/studyo/ayarlar` yayın kartı: TASLAK/CANLI rozeti, "Yayınla / Yayından kaldır", canlı link kopyalama. `PATCH /api/venue` artık **kısmi güncelleme** yapıyor (yalnız gelen alanlar yazılır) ve `isPublished` + `slug` kabul ediyor. `published_at` yalnız ilk yayında yazılır, yayından kaldırınca silinmez (arşiv). Yayın öncesi alerjen onayı bekleyen ürün sayısı gösterilir ve onay istenir — bloke edilmez (beyan sorumluluğu işletmede). Menü adresi (slug) düzenlenebilir; unique çakışması 409 + Türkçe mesaj.
- **B2 · QR yönlendirme. ✅ TAMAMLANDI.** `/studyo/qr`: etiketli kod üretimi ("Masa 4"), etiket düzenleme, devre dışı bırakma (kod ASLA silinmez), PNG + baskıya hazır A6 masa kartı PDF indirme. `/q/{code}` yönlendirme: kod yok / devre dışı / menü yayında değil durumları ayrı ayrı ele alınır. Kod okuması **service-role** ile yapılır çünkü `qr_select` policy'si (`is_active or is_org_member`) anonime pasif kodu göstermez → "yok" ile "pasif" ayrımı yapılamazdı. **Not:** `qr_codes.org_id` NOT NULL ama `app.fill_org_id` trigger'ı bu tabloyu kapsamıyor; org_id API'de venue'dan okunup elle yazılıyor (migration gerekmedi).
- **B3 · Çerezsiz analitik. ✅ TAMAMLANDI.** `src/lib/analytics.ts`: `session_key = sha256(günlük salt + ip + user-agent)`. Salt her gün yeniden üretilir, **hiçbir yerde saklanmaz** → ertesi gün geriye dönük eşleştirme yapılamaz, çerez izni bandı gerekmez. Salt `globalThis`'te tutulur (modül seviyesi YETMEZ: Next her route'u ayrı bundle'a derler, her kopya kendi salt'ını üretip tekil sayımı bozar). Olaylar: `scan` → `/q/{code}` render'ında (qr_code_id ile, hangi masa tarandı), `menu_view` → `/m/{slug}` render'ında (yalnız yayındaysa; sahibin önizlemesi sayılmaz), `item_view` → `POST /api/scan` (istemci, oturum başına ürün başına bir kez). Bot/link-önizleme user-agent'ları elenir. Yazma yalnız service-role (scan_events'te INSERT policy yok). `/api/scan` public olduğu için: venue yayında mı + ürün gerçekten o org'a ait mi + IP başına 60 istek/dk sınırı. Middleware misafir yollarında oturum çerezi yoksa erken çıkar (her QR okutmasında gereksiz `getUser()` yapılmaz).
- **B4 · Hesap kalıcılaştırma. ✅ TAMAMLANDI (magic link).** Anonim oturum `updateUser({email})` ile e-postaya bağlanır — `user.id` KORUNUR (ham GoTrue PUT /user ile doğrulandı: 200, id değişmedi, `new_email` + `email_change_sent_at` set). Yeni hesap açılmaz, veri taşınmaz, org sahipliği aynen kalır. `/auth/callback` PKCE `exchangeCodeForSession`; kod yok/geçersiz/süresi dolmuş/e-posta kayıtlı durumları için ayrı Türkçe mesaj. `/studyo/hesap` "Hesabını güvene al" kartı (GEÇİCİ/GÜVENDE rozeti) + studyo girişinde anonim uyarı bandı. Telefon: `organizations.contact_phone` (hesap sahibinin numarası — `venues.phone` DEĞİL), doğrulamasız (SMS Faz C). **Google:** kod hazır (`linkIdentity` + aynı callback), yalnız Supabase paneli + Google Cloud OAuth kurulumu bekliyor. **0009 migration UYGULANDI** (2026-07-19; `contact_phone` + `contact_phone_verified_at` sütunları mevcut).
- **B5 · Dashboard. ✅ TAMAMLANDI.** `/studyo/pano`: yayın durumu rozeti + menü linki, uyarı bantları (anonim hesap / yayınlanmamış / bekleyen alerjen onayı), durum kartları (ürün, onaylı ürün, aktif QR, 30 gün tarama), son 30 gün analitiği (QR tarama / menü görüntüleme / ürün görüntüleme / tekil ziyaretçi) + saf SVG yığılmış günlük bar grafik (istemci JS yok), veri yokken "QR'ını bastır" boş durumu, hızlı eylem linkleri. Tüm okumalar user-client + RLS (`scan_select` org üyesine okuma verir). `/studyo` girişi: `bootstrap` artık `hasMenu` döndürüyor; menüsü olan kullanıcıya "Panoya git" bandı gösterilir. Toplama mantığı gerçek veride doğrulandı (40 olay → 14/13/13, 5 tekil ziyaretçi, günlük kovalar doğru).

**Faz B TAMAMLANDI** (B1 yayınlama, B2 QR, B3 analitik, B4 hesap kalıcılaştırma [magic link], B5 dashboard). Kalan: deploy (aşağıdaki kontrol listesi) + opsiyonel Google girişi.

## Faz C — Freemium + faturalama (M5)
- **Ücretsiz plan** (üyelik + telefon şartıyla): 1 venue, **< 50 ürün**, **5 dile** çeviri, arka plan/ürün görseli **YOK**, "RotaMenu" rozeti.
- **Pro**: sınırsız/yüksek ürün, tüm diller, ürün + kategori görselleri, rozet kaldırma, öncelikli işleme.
- Ödeme: TR **iyzico**, global **Stripe/Paddle** (karar M5'te netleşir).

### C-çekirdek · Plan zorlaması ✅ TAMAMLANDI (2026-07-20, sağlayıcıdan bağımsız)
Migration GEREKMEDİ — `organizations.plan` (plan_tier enum) zaten mevcut; `contact_phone` 0009'da eklenmişti.
- **`src/lib/plans.ts`** — tek kaynak: plan limitleri (`maxVenues/maxItems/maxLocales/images/removeBadge/requiresVerifiedAccount`) + yardımcılar (`planLimits`, `normalizePlan`, `showRotaMenuBadge`, `loadOrgPlanUsage`, `UPGRADE_MESSAGES`). Bilinmeyen plan → güvenli `free`.
- **Görsel kilidi (A7/A8).** `/api/image/generate`, `/api/image/enhance`, `/api/image` (PATCH, yalnız BAĞLAMA; kaldırma=null her planda serbest) free planda **402 `upgrade_required`**. UI: `/studyo/gorseller` free planda tam yükseltme ekranı gösterir (manager render edilmez).
- **Ürün limiti.** `/api/ingest/[id]/approve` yıkıcı işlemlerden ÖNCE toplamı hesaplar: (diğer yüklemelerin ürünleri) + (taslak ürünleri) > limit ise **402**. Yeniden onayda kendi ürünlerini çift saymaz.
- **Yayın şartı.** `/api/venue` PATCH `isPublished=true`: free planda hesap **güvende (anonim değil + e-posta)** ve **contact_phone dolu** değilse **403 `account_required`**.
- **Rozet.** `/m/[slug]` "RotaMenu ile hazırlandı" artık plana bağlı (`showRotaMenuBadge`); Pro/Enterprise'da gizli.
- **Plan kartı.** `/studyo/pano` — plan rozeti, ürün kullanım çubuğu (X/50, %80'de amber, dolunca kırmızı), özellik satırları (görsel/rozet kilit durumu), free planda yayın şartları checklist'i + "Pro'ya yükselt" CTA (şimdilik `/studyo/hesap`'a).
- Doğrulama: `tsc --noEmit` temiz. Tam `next build` deploy öncesi Windows'ta koşulacak (sandbox ağ/CPU kısıtı).
- **✅ CANLIDA DOĞRULANDI (2026-07-20, commit `f877648`):** plan kartı, görsel kilidi, yayın şartı, rozet, ürün limiti — hepsi test edildi ve geçti.

### C-faturalama · iyzico abonelik ✅ KOD TAMAMLANDI (2026-07-20) — kurulum + sandbox testi bekliyor
Sağlayıcı: **iyzico** (TR). Resmi `iyzipay` Node SDK'sı + abonelik Checkout Form. Fiyat/periyot iyzico panelindeki **pricing plan**'da tanımlı; kodda tutulmaz (yalnız `IYZICO_PRO_PRICING_PLAN_REF`).
- **Migration `0010_subscriptions.sql`** — `subscriptions` tablosu (iyzico refs, status, current_period_end, raw). RLS: org üyesi okur, yazma yalnız service-role. `organizations.plan` yetki anahtarı olmaya devam eder.
- **`src/lib/iyzico.ts`** — SDK sarmalayıcı (promisified init/retrieve/cancel/retrieveSubscription). SDK'da eksik olan `subscriptionCheckoutForm.retrieve` çalışma anında güvenle bağlanıyor. `src/types/iyzipay.d.ts` tip shim (paket tipsiz). `next.config` → iyzipay serverExternalPackages (fs.readdirSync bundle sorunu).
- **`/api/billing/checkout`** — owner fatura formuyla abonelik Checkout Form başlatır, `checkoutFormContent` döner; bekleyen `subscriptions` satırı token ile kaydedilir.
- **`/api/billing/callback`** — iyzico dönüşü: token → retrieve (sonucu KULLANICIDAN değil iyzico'dan okur) → `organizations.plan='pro'` + satır güncelle → `/studyo/plan?upgrade=success`.
- **`/api/billing/webhook`** — yenileme/iptal/expire: ref'i alır, durumu iyzico'dan doğrular (sahte webhook etkisiz), ACTIVE→pro / CANCELED·EXPIRED·UNPAID→free.
- **`/api/billing/cancel`** — owner iptali; dönem sonuna kadar Pro kalır (status=CANCELED), expire webhook'u free'e çeker.
- **`/studyo/plan`** — plan karşılaştırma + fatura formu + iyzico form enjeksiyonu; Pro'da durum + iptal. Pano/görseller "Pro'ya yükselt" CTA'ları buraya bağlandı.
- Doğrulama: `tsc --noEmit` temiz. **Sandbox testi + kurulum kullanıcıda** (aşağıdaki runbook).

**Durum (2026-07-20):** Kod deploy edildi, billing rotaları `IYZICO_*` env yokken zarifçe devre dışı (`/studyo/plan` "çok yakında" mesajı gösteriyor, uygulama çökmüyor — doğrulandı). iyzico sandbox üyeliğinde "beklenmedik hata" alındı; kurulum ERTELENDİ. Aşağıdaki runbook'a ne zaman dönülürse oradan devam edilir, kodda değişiklik gerekmez.

**⚠️ Geliştirme bypass (GEÇİCİ, iyzico bağlanınca kaldırılacak):** `/studyo/plan`'da "Pro'ya geç (iyzico bypass)" / "Ücretsize dön (test)" düğmeleri eklendi — `/api/billing/dev-upgrade` ve `/api/billing/dev-downgrade`. Ödeme olmadan `organizations.plan`'ı değiştirir, `subscriptions`'a `provider='manual_bypass'` satırı yazar (denetim izi). **Otomatik kilit:** `IYZICO_*` env değişkenleri tanımlanır tanımlanmaz (`isIyzicoConfigured()` true) her iki rota da 403 döner ve UI'daki amber "Geliştirme modu" kutusu görünmez olur — env eklenince kod değişikliği gerekmez, kendiliğinden kapanır. **Kalıcı kaldırma** (iyzico tam kurulunca, temizlik için): `src/app/api/billing/dev-upgrade/`, `src/app/api/billing/dev-downgrade/` klasörlerini ve `plan-client.tsx`'teki `DevBypass` bileşenini + iki çağrı noktasını sil.

#### Faturalama kurulum runbook (kullanıcı)
1. `npm install` (yeni bağımlılık: `iyzipay`).
2. Supabase'de **0010_subscriptions.sql**'i uygula (Windows, service_role).
3. iyzico panelinde: Abonelik ürünü + **Pro pricing plan** oluştur (aylık, TL, fiyat) → referans kodunu al.
4. Env (yerel `.env.local` + Netlify): `IYZICO_URI` (önce sandbox), `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_PRO_PRICING_PLAN_REF`. `NEXT_PUBLIC_SITE_URL` zaten var (callback bundan türer).
5. iyzico panelinde **webhook URL**'i ayarla: `https://<alan>/api/billing/webhook`.
6. Sandbox test kartıyla (`5528790000000008`) uçtan uca dene: /studyo/plan → öde → callback → plan pro → iptal → webhook free.
7. Doğrulandıktan sonra `IYZICO_URI`'yi prod'a çevir (`https://api.iyzipay.com`) + prod anahtarlar.

### C-faturalama · opsiyonel sonraki
- `current_period_end`'i retrieve/webhook'tan kesin doldurma (şu an null; iptal/expire webhook'u yeterli). Yıllık plan seçeneği. Fatura/makbuz e-postası.

### C-kayıt akışı + telefon doğrulama ✅ TAMAMLANDI (2026-07-20, kısmen geçici)
- **Hesap sayfası yeniden çerçevelendi:** `/studyo/hesap` artık "ücretsiz plan kaydı" olarak sunuluyor ("Ücretsiz menü için kaydol", "KAYIT GEREKLİ" / "KAYITLI" rozetleri). Fonksiyon aynı (`updateUser({email})`, `user.id` korunur). `/studyo` ve pano'daki bantlar da aynı dile çekildi.
- **⚠️ Telefon doğrulama bypass (GEÇİCİ).** Gerçek SMS OTP akışı henüz yok. `src/lib/sms.ts` → `isPhoneVerificationConfigured()` (şimdilik hep `false`, `SMS_PROVIDER_API_KEY` yoksa). `/api/account/dev-verify-phone` telefonu kod göndermeden `contact_phone_verified_at`'ı doldurur. Hesap sayfasında telefon alanı doluysa ve doğrulanmamışsa amber "Geliştirme modu" kutusunda "Telefonu doğrula (bypass)" düğmesi çıkar. **Otomatik kilit:** `SMS_PROVIDER_API_KEY` eklenince rota 403 döner, düğme kaybolur — iyzico bypass ile birebir aynı desen. **UNUTMA:** Google girişi eklendiğinde ("Google ile üye olunca telefon koduyla onay isteriz") bu, gerçek SMS OTP + `/api/account/verify-phone` (gönder/doğrula iki adım) ile değiştirilecek; `contact_phone_verified_at` şu an publish gate'e BAĞLI DEĞİL (yalnız `contact_phone` doluluğu kontrol ediliyor, bkz. plans.ts) — ileride "gerçekten doğrulanmış" şartına sıkılaştırılabilir.
- **`/studyo` menü listesi:** kullanıcının menüsü varsa artık "Menülerin" başlıklı bir kart altında venue adı + `/m/{slug}` + "Panoya git" düğmesiyle listeleniyor (önceden yalnız genel bir bant vardı). `/api/bootstrap` yanıtına `name` eklendi.

### A8 revizyonu · Kategori arka planı: şerit / büyük ✅ TAMAMLANDI (2026-07-20)
- **Migration `0012_category_background_style.sql`** — `categories.background_style` (`'strip'` varsayılan | `'hero'`). Görsel URL'inden bağımsız tercih; görsel silinse de tercih kalır.
- **`/api/category/background-style`** PATCH — editor+ yetkisi, tek alan günceller.
- **`/studyo/gorseller`** — her kategoride görsel varsa küçük "Şerit / Arka plan (büyük)" toggle'ı (iyimser güncelleme, hata olursa geri alır).
- **Misafir menüsü (`guest-menu.tsx`):** `hero` seçiliyse kategori görseli sabit yükseklikte (h-72/80), mutlak konumlu, bölümün EN ÜSTÜNE yerleşir; ürünler normal akışta üstüne yığılır (fotoğrafı aşan ürünler düz sayfa zemininde devam eder). **v2 düzeltmesi (aynı gün):** ilk versiyon tüm ürünleri TEK bir beyaz panelde topluyordu — kullanıcı geri bildirimiyle her ürün artık KENDİ gri/şeffaf camsı kartında (`bg-stone-900/45 backdrop-blur`, beyaz metin), kartlar arası boşlukla, fotoğraf aralardan görünsün diye. `strip` (varsayılan) eski küçük banner davranışını korur.
- **v3 — sabit (sticky) foto + crossfade:** Hero fotoğraf `position: sticky` (`top-14`, nav'ın hemen altı). Üstteki sekme çubuğu zaten `sticky top-0` + aktif sekmeyi yatayda `scrollTo({behavior:'smooth'})` ile ortalıyordu; bu davranış `active` state'ini fotoyla paylaştığı için senkron.
- **v4 — sticky "durma alanı" bugu düzeltildi:** v3'te resmin akışa kattığı yüksekliği negatif `margin-bottom` ile sıfırlıyordum — bu, sticky'nin "durabileceği" konteyner yüksekliğini de sıfırlıyordu, yani resim hiç tutunamadan sayfayla kayıyordu (kullanıcı: "hala yukarı çıkıyor"). Düzeltme: resmin kutusu artık NORMAL akışta kalıyor (negatif margin YOK, gerçek yükseklik katkısı var — bu, sticky'nin durma alanını sağlıyor); bunun yerine İÇERİK bloğu (başlık + ürün kartları) negatif üst-margin (`-mt-72`/`-mt-80`) ile fotoğrafın üzerine biniyor. Sonuç: foto, o kategorinin ürünleri kaydırılırken gerçekten ekranda sabit kalıyor, kategori bitince `active` state değişip opacity crossfade (700ms) ile bir sonraki fotoğrafa yumuşak geçiyor. Not: çok az ürünlü (foto boyundan kısa) kategorilerde sticky'nin durma süresi kısa/yok olabilir — nadir edge case, kabul edilebilir.
- **⚠️ Bulunan + düzeltilen sticky bug:** dış kart kapsayıcısında (`sm:overflow-hidden`, yuvarlak köşe kırpmak için) `position: sticky`'yi kıran klasik CSS hatası vardı — `overflow` != `visible` olan bir ata, sticky'nin "en yakın scroll atası" sayılır ve masaüstünde (`sm:` ve üstü) kategori sekmeleri üstte sabit KALMIYORDU. Bu ÖNCEDEN DE vardı, yeni hero özelliğiyle ilgisi yoktu — kullanıcı test ederken fark edildi. Düzeltme: dış kapsayıcıdan `overflow-hidden` kaldırıldı, üst köşe yuvarlaması yerine doğrudan header'ın kendi üstüne (`sm:rounded-t-2xl`) taşındı. Artık masaüstünde de sekmeler doğru sabitleniyor.
- Doğrulama: `tsc --noEmit` temiz.

### C-pano iyileştirmeleri ✅ TAMAMLANDI (2026-07-20)
- **Ana sayfa yönlendirmesi:** `/` artık server component. Oturumu olan VE en az bir kategorisi (menüsü) oluşmuş dönen kullanıcı pazarlama sayfasını görmeden direkt `/studyo/pano`'ya düşer (`redirect()`). Yeni ziyaretçide (oturum çerezi yok) hiçbir oturum açılmaz, pazarlama sayfası normal render edilir.
- **Hızlı link ismi:** "Menü / yükle" → "Menüye resim yükle" (`/studyo/pano`).
- **Canlı telefon önizlemesi:** `/studyo/pano` artık iki kolon (`lg:grid-cols-[1fr_320px]`); sağda saf CSS telefon çerçevesi içinde `<iframe src="/m/{slug}">` — sticky, sayfa kaydırılınca sabit kalır. RLS zaten org üyesine `is_published` şartı olmadan okuma izni veriyor (`categories_select`/`items_select`: `is_org_member(org_id) OR yayında`), yani TASLAK menüler de önizlemede doğru görünür.
- **⚠️ Bulunan + düzeltilen analitik hatası:** `/m/[slug]/page.tsx`'teki eski yorum "sahibin önizlemesi sayaçları şişirmemeli" diyordu ama kod yalnız `is_published`'a bakıyordu — sahibin ziyaretini asla ayırt etmiyordu. Telefon önizlemesi pano her yüklendiğinde otomatik istek atacağından bu, gerçek `menu_view` sayılarını ciddi şişirirdi. Düzeltme: sayfa artık `auth.getUser()` + `organization_members` ile "bu ziyaretçi org üyesi mi" kontrolü yapıyor (`isOwnerViewing`); öyleyse `recordEvent` hiç çağrılmıyor. Misafir sayımları etkilenmedi.

### C-süper-admin kontrol paneli ✅ TAMAMLANDI (2026-07-20)
Platform sahibi (biz) için tüm kiracıları gören ayrı, şifreli panel — normal kullanıcı auth'undan bağımsız.
- **`src/lib/admin-auth.ts`** — tek paylaşılan şifre (`ADMIN_PASSWORD` env) + imzalı (HMAC-SHA256, aynı şifre anahtar), süreli (12 saat) httpOnly çerez (`ros_admin`). `ADMIN_PASSWORD` boşsa panel tamamen kapalı (varsayılan kapalı).
- **`/admin`** — şifre giriş formu → `/api/admin/login` (yanlış şifrede 400ms gecikme, kaba kuvvete karşı). **`/api/admin/logout`** çerezi temizler.
- **`/admin/panel`** — `requireAdmin()` korumalı, service-role ile TÜM venue'ları listeler (işletme adı, `/m/{slug}` linki, sahibin e-postası — `auth.admin.getUserById` ile, plan rozeti, CANLI/TASLAK durumu, oluşturulma tarihi) + her satırda **"Panoya git"**.
- **`/admin/venue/[id]`** — salt-okunur işletme panosu (plan, ürün sayısı, aktif QR, son 30 gün tarama/görüntüleme, telefon + doğrulama durumu, ilk yayın tarihi). `/studyo/pano` ile aynı ruhta ama venueId URL'den gelir ve YAZMA yoktur.
- Doğrulama: `tsc --noEmit` temiz. **Canlıda kurulum:** Netlify'a `ADMIN_PASSWORD` env'i eklenmeden `/admin` 501 döner (güvenli varsayılan).

## Faz D — Sipariş sistemi + analitik (v2)
- Misafir menüden **sipariş** verebilir.
- Her restoranın sipariş **veritabanı**; tüm siparişler kaydedilir.
- Bu veriden işletmeye **faydalı değerlendirmeler/analizler** (en çok satan, saat/gün trendi, sepet ortalaması, vb.).
- Aylık/yıllık **abonelik** (bu katman için ayrı ücret).

---

## ⚠️ DEPLOY ANINDA YAPILACAKLAR (ertelendi — Faz B bitince tek seferde)
Karar: uygulama şu an yalnız yerelde çalışıyor (hosting/alan adı yok). Deploy, Faz B tümüyle bitince tek seferde yapılacak. O an aşağıdakiler tamamlanmalı:
- **Hosting: Netlify** (kullanıcı Netlify'a alışkın). `netlify.toml` repoda hazır (`npm run build`, `.next`, `@netlify/plugin-nextjs`, NODE 20, `--include=dev`). GitHub `sapieneo/RotaMenu` → Import. Env değişkenlerini taşı: Supabase URL/anon/service_role, `ANTHROPIC_API_KEY`, `RUNWARE_API_KEY`, sonra `NEXT_PUBLIC_SITE_URL` (netlify.app adresi, build anında gömülür → ekleyince yeniden deploy).
- **`NEXT_PUBLIC_SITE_URL`:** prod'da gerçek alan adı (ör. `https://menu.isletmem.com`, sonda `/` yok). Magic link `emailRedirectTo` ve QR gömülü adresi bundan türüyor.
- **Supabase → Authentication → URL Configuration:** Site URL'i canlı adrese çevir; Redirect URLs'e `https://<alan-adı>/auth/callback` ekle (localhost satırını silme, ikisi birlikte dursun).
- **Supabase → Custom SMTP:** varsayılan e-posta gönderimi sıkı rate-limitli ("email rate limit exceeded" testte görüldü). Gerçek kullanıcı almadan önce kendi SMTP'ni (SendGrid/Resend/SES) tanımla.
- **0009 migration:** ✅ uygulandı (2026-07-19). Not: tek Supabase projesi kullanılıyor (yerel + canlı aynı DB), ayrı prod DB yok.
- **Google girişi (opsiyonel):** istenirse Google Cloud OAuth client + Supabase Google provider kurulumu; sonra `linkIdentity` butonu eklenecek.

## Açık teknik notlar
- **RLS/oturum doğrulaması:** Anonim kullanıcının `organizations` INSERT'i user-client + RLS ile 42501 verdi; bootstrap provizyonu güvenli şekilde service-role + `created_by = user.id` ile yapılıyor (route kullanıcıyı doğruluyor). User-client RLS **okuma** çalışıyor (taslak görüntülendi). M2 confirm (user RPC) ve approve (user-client yazma) canlıda test edilecek; sorun çıkarsa kritik yazımlar SECURITY DEFINER RPC'ye taşınır.
- **Görsel üretimi maliyeti** (A7/A8) Faz C fiyatlandırmasına bağlanacak.
- **✅ /api/scan rate limit — KALICI ÇÖZÜM UYGULANDI + CANLIDA DOĞRULANDI (2026-07-20, migration 0011).** Eski durum: bellek içi Map serverless'te örnekler arası paylaşılmıyordu (70 istekte 0×429). Çözüm: `scan_events.occurred_on` (üretilmiş UTC günü) + `(event_type, session_key, item_id, occurred_on)` TAM unique index; `recordEvent` artık `upsert(ignoreDuplicates)` — aynı ziyaretçi+ürün+gün için tek `item_view`, mükerrer istek DB'de sessizce düşer. `scan`/`menu_view`'da item_id NULL (NULLS DISTINCT) → ham sayımlar etkilenmez. Kısmi index bilerek KULLANILMADI (PostgREST ON CONFLICT kısmi index çözemez). Bellek içi pencere en-iyi-çaba fren olarak duruyor. Kabul edilen sınır: salt örnek-başına → çok örnekli dağıtımda ziyaretçi başına en çok ~örnek sayısı satır (sınırsız şişirme bitti). Migration 0011 canlıda uygulanınca aktif; index oluşturmadan önce mevcut mükerrerleri temizler.
