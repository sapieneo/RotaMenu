# RotaMenu — HANDOFF

Son güncelleme: **2 Ağustos 2026**  
Amaç: Bu dosyayı yeni bir Codex görevinde açıp projeyi kaldığımız yerden devam ettirmek.

## 1. Proje kimliği

- Ürün: **RotaMenu** — restoranların fotoğraf/PDF menülerini yapay zekâyla dijital, çok dilli ve QR kodlu menüye dönüştüren SaaS.
- Yerel çalışma klasörü: `C:\Rotamenu`
- GitHub: https://github.com/sapieneo/RotaMenu
- Ana dal: `main`
- Canlı site: https://rotamenu.netlify.app
- Netlify site adı: `rotamenu`
- Netlify site ID: `7f080727-b075-4300-b3d5-114f375dd50c`
- Netlify paneli: https://app.netlify.com/projects/rotamenu
- Supabase proje ref: `vaqhdaaqdsgfajqdvzls`
- Supabase paneli: https://supabase.com/dashboard/project/vaqhdaaqdsgfajqdvzls

## 2. Teknoloji ve temel akış

- Next.js 14 App Router + TypeScript
- Supabase: Postgres, Auth, Storage ve RLS
- Netlify: canlı yayın ve serverless Next.js çalıştırma
- OpenAI Responses API: OCR, menü çıkarma ve metin tabanlı yapay zekâ görevleri
- Runware: ürün görseli üretimi; değiştirilmedi
- iyzico: ödeme/abonelik kodu kısmen hazır, canlı kurulum bekliyor

Ana kullanıcı akışı:

1. Kullanıcı `/studyo` ekranından fotoğraf veya PDF yükler.
2. AI menüyü yapılandırılmış JSON olarak çıkarır.
3. Kullanıcı menüyü düzeltir ve alerjen/diyet bilgilerini onaylar.
4. İşletme bilgileri tamamlanır.
5. Menü `/m/[slug]` adresinde yayınlanır ve QR kod üretilir.

## 3. Claude → OpenAI geçişi

Claude/Anthropic uygulama kodundan çıkarıldı; OpenAI kullanılıyor.

Başlıca değişiklikler:

- `src/lib/ai/openai.ts` eklendi.
  - OpenAI SDK eklenmeden, yerleşik `fetch` ile Responses API çağrılıyor.
  - İstekler `store: false` ile gönderiliyor.
  - Zaman aşımı, HTTP durum kodu, OpenAI hata kodu ve request ID işleniyor.
- `src/lib/ai/extract.ts` OpenAI multimodal girişine geçirildi.
  - Fotoğraf ve PDF kabul ediyor.
  - Strict JSON Schema structured output kullanıyor.
  - Çıktı ayrıca Zod ile doğrulanıyor.
- `src/lib/ai/image.ts` içindeki Claude metin görevleri OpenAI'a geçirildi.
  - Görsel üretimi hâlâ Runware üzerinden yapılıyor.
- Anthropic bağımlılığı ve `ANTHROPIC_*` ortam değişkenleri kaldırıldı.
- README, ARCHITECTURE, ROADMAP ve `.env.example` güncellendi.

Model ayarları:

- `OPENAI_MENU_MODEL`: varsayılan `gpt-5.6-terra`
- `OPENAI_TEXT_MODEL`: varsayılan `gpt-5.6-luna`

Önemli: Model erişim hatası alınırsa önce OpenAI projesinin bu modellere erişimi kontrol edilmeli; gerekirse hesaba açık bir modelle değiştirilmelidir.

## 4. Ortam değişkenleri

`OPENAI_API_KEY`:

- Yerel `.env.local` dosyasına eklendi.
- Netlify'a kullanıcı tarafından manuel olarak **secret** şeklinde eklendi.
- Netlify kapsamları: builds, functions ve runtime.
- Production başta olmak üzere gerekli deploy context'lerinde değer mevcut.

Netlify'da ayrıca şunlar mevcut:

- `OPENAI_MENU_MODEL`
- `OPENAI_TEXT_MODEL`

Anthropic değişkenleri Netlify'dan kaldırıldı. Gizli anahtar değerlerini bu dosyaya veya Git'e yazma.

Güvenlik notu: Önceki görevde `.env.local` değerleri araç çıktısında yanlışlıkla göründü. OpenAI anahtarı kullanıcı tarafından yenilendi. Kullanıcı, çalıştığı için Runware anahtarını yenilemek istemedi.

## 5. Git ve deploy durumu

Son iki önemli commit:

- `0f50640` — `Migrate AI provider to OpenAI`
- `aed5503` — `Improve OpenAI error diagnostics`

Kontrol anındaki durum:

- Yerel `HEAD`: `aed550355efefe8ef4c9079f6ad81fe64470b2d6`
- `origin/main`: aynı commit
- Yerel dal ile GitHub senkronize.
- Netlify production deploy ID: `6a6f9085dc547a0008c55ec8`
- Deploy durumu: **ready**
- Deploy edilen commit: `aed550355efefe8ef4c9079f6ad81fe64470b2d6`
- Yayın zamanı: `2026-08-02T18:47:23Z`
- Secret scan: temiz

Çalışma ağacındaki kasıtlı olarak commitlenmemiş dosyalar:

- `HANDOFF.md` — bu devir dosyası
- `src/lib/themes.ts` — önceki çalışmadan kalan, bu AI geçişiyle ilgisiz dosya

`src/lib/themes.ts` içeriğini incelemeden hiçbir commit'e ekleme.

## 6. Doğrulamalar

OpenAI geçişinden sonra aşağıdakiler başarıyla çalıştı:

- `npm run typecheck`
- `npm run build` — 39 route/page üretildi
- `npm run test:rls` — bütün testler geçti

Tanılama iyileştirmesinden sonra ayrıca:

- `npm run typecheck` geçti
- `npm run build` geçti

## 7. Şu anki kritik sorun

Canlı `/studyo` menü yükleme ekranında kullanıcı şu hatayı alıyordu:

> AI servisi yanıt vermedi. Lütfen tekrar deneyin.

OpenAI dashboard Logs ekranında istek görünmüyordu. Supabase `menu_ingestions` tablosundaki son denemeler yaklaşık 0,3–0,9 saniyede `failed` olmuş ve yalnızca aynı genel hata mesajını kaydetmişti.

Bu denemeler, yeni tanılama commit'inin canlıya alınmasından **önce** yapıldı. Son başarısız deneme yaklaşık `2026-08-02 18:37 UTC`; tanılama deploy'u yaklaşık `18:47 UTC` tarihinde yayınlandı. Bu nedenle yeni tanılama kodu henüz gerçek bir yüklemeyle test edilmedi.

`aed5503` ile güvenli hata ayrıntıları eklendi:

- HTTP 401: anahtar geçersiz/iptal edilmiş
- HTTP 403: model/proje erişimi yok
- HTTP 404: model bulunamadı veya kullanılamıyor
- HTTP 429: bakiye, harcama limiti veya rate limit
- HTTP 400: istek doğrulama hatası
- Ortam değişkeni eksikliği
- Ağ veya zaman aşımı

API route'ları yalnızca güvenli tanı alanlarını logluyor; secret değerleri loglanmıyor.

## 8. Yeni görevde yapılacak ilk işlem

1. Canlı sitede https://rotamenu.netlify.app/studyo aç.
2. Aynı menü fotoğrafını/PDF'ini yeniden yükle.
3. Ekranda çıkan **yeni ve daha açık hata mesajını** kaydet.
4. Supabase'de en yeni kaydı kontrol et:

```sql
select id, status, error_message, created_at, updated_at
from public.menu_ingestions
order by created_at desc
limit 5;
```

5. Sonuca göre ilerle:
   - **401:** Netlify'daki OpenAI anahtarını yeniden kopyala/yenile ve redeploy et.
   - **403/404:** OpenAI hesabının erişebildiği model adını belirle; Netlify model değişkenlerini güncelle.
   - **429 / quota:** OpenAI API Billing'e ödeme yöntemi veya kredi ekle; ChatGPT aboneliğinin API kredisi olmadığını unutma.
   - **400:** OpenAI request gövdesini incele. Özellikle PDF `file_data`, JSON Schema ve modelin Responses API özellik desteğini kontrol et.
   - **Ağ/zaman aşımı:** Netlify function loglarını ve outbound bağlantıyı incele.

OpenAI bağlantıları:

- Kullanım: https://platform.openai.com/usage
- Billing: https://platform.openai.com/settings/organization/billing/overview
- API logları: https://platform.openai.com/logs

## 9. Daha sonra ele alınacak işler

- OpenAI menü çıkarma akışını canlıda uçtan uca doğrulamak
- Gerçek SMS OTP/Netgsm entegrasyonunu etkinleştirmek; geliştirme bypass'ını kaldırmak
- iyzico canlı/sandbox kurulumunu tamamlamak ve ödeme bypass'ını kaldırmak
- Google OAuth kurulumunu tamamlamak
- Çok ülke, dil, para birimi ve yerel mevzuat desteğini sistematikleştirmek
- Landing page'i gerçek ürün tanıtımı, örnek menü, fiyatlandırma ve güven unsurlarıyla geliştirmek
- `src/lib/themes.ts` dosyasının neden untracked olduğunu inceleyip uygun kararı vermek

## 10. Codex çalışma yetkileri ve pratikler

- Codex `C:\Rotamenu` içinde dosya okuyup düzenleyebilir ve test çalıştırabilir.
- GitHub connector okuma için bağlıdır; yerel `.git` yazımı sandbox nedeniyle sınırlı olabilir.
- Kullanıcı kendi PowerShell penceresinden commit/push yapabilir.
- Netlify connector proje/deploy/env durumunu okuyabilir. Secret güncellemesi UI üzerinden daha güvenilir oldu.
- Supabase connector bağlıdır; SQL sorguları, migration ve log kontrolleri yapılabilir.
- Uygulama içi tarayıcı ile canlı site açılıp görsel kontrol yapılabilir.
- Secret değerlerini hiçbir zaman sohbete, loga, HANDOFF'a veya Git'e yazma.

## 11. Yeni Codex görevine verilecek kısa talimat

> `C:\Rotamenu\HANDOFF.md` dosyasını ve repo durumunu oku. Önce `git status -sb` ile `main`/`origin/main` eşitliğini doğrula. Sonra Netlify'da güncel `main` commit'inin production'da ready olduğunu kontrol et. Canlı `/studyo` ekranında yeni bir menü yükleme testi yapalım ve tanılama mesajına göre OpenAI bağlantı sorununu düzeltelim.
