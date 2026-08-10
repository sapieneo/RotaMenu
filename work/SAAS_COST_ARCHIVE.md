# RestaurantOS — SaaS Maliyet Arşivi

Başlangıç: 10 Ağustos 2026  
Sahip: Ürün yönetimi  
Kural: Gizli anahtarlar, kart numaraları veya fatura kişisel verileri bu dosyaya yazılmaz.

## Amaç

Bu arşiv, RestaurantOS'un sabit ve kullanıma bağlı maliyetlerini ürün kararlarına bağlar. Her güncellemede yalnız tutar değil; kaynağı, dönemi, birimi, müşteri/menü başına etkisi ve alınan karar kaydedilir.

## Maliyet kaynakları envanteri

| Kaynak | Maliyet türü | Tetikleyici | Kritik kontrol | Güncel durum |
|---|---|---|---|---|
| OpenAI Responses API | Değişken | Menü OCR, çeviri, açıklama | Token/girdi dosyası, hata oranı, org günlük kota | Kullanım-kota koruması hazırlanıyor; production migration doğrulaması bekliyor |
| Runware | Değişken | Ürün/kategori görseli | Görsel başına maliyet, tekrar üretim | Pro özelliği; kullanım sınırı doğrulanmalı |
| Supabase | Sabit + ölçeklenebilir | Veritabanı, Auth, Storage, egress | DB/storage/bant genişliği, SMTP limitleri | Production bağımlılığı |
| Netlify | Sabit + ölçeklenebilir | Hosting, function, bandwidth | Function süresi, build, bandwidth | Production bağımlılığı |
| iyzico | Değişken | Abonelik tahsilatı | Başarılı ödeme, komisyon, iade/chargeback | Kod hazır; sandbox/canlı kurulumu bekliyor |
| E-posta/SMTP | Sabit + değişken | Magic-link, işlem e-postaları | Teslimat, gönderim limiti, maliyet | Production SMTP doğrulaması bekliyor |
| Alan adı / DNS | Sabit yıllık | Marka alan adı | Yenileme tarihi, SSL/DNS | Ayrı takip gerekli |
| Gözlemlenebilirlik | Sabit + değişken | Hata ve maliyet uyarıları | Log/alert kotası | Karar ve kurulum bekliyor |

## Birim ekonomi kaydı

Her takvim ayında aşağıdaki satırlar gerçek fatura/usage verisiyle doldurulur. Tahmini tutar ile gerçekleşen tutar ayrı tutulur.

| Dönem | Aktif işletme | Ücretli işletme | MRR (TL) | OpenAI | Runware | Supabase | Netlify | SMTP | iyzico komisyonu | Diğer | Toplam maliyet | Brüt marj | Not / karar |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 2026-08 | — | — | — | — | — | — | — | — | — | — | — | — | Başlangıç ayı; gerçek faturalar bekleniyor |

## Operasyon metrikleri

| Tarih | Metrik | Değer | Kaynak | Eşik | Aksiyon |
|---|---|---:|---|---|---|
| 2026-08-10 | AI kota release durumu | Bekliyor | Kod + migration | Migration uygulanmadan deploy yok | Migration, RPC grant ve E2E test tamamlanmalı |
| 2026-08-10 | Magic-link production E2E | Bekliyor | /giris | Farklı cihazda başarılı giriş | SMTP + redirect URL testi |
| 2026-08-10 | iyzico E2E | Bekliyor | /studyo/plan | Checkout, callback, iptal, webhook | Sandbox runbook tamamlanmalı |

## Güncelleme protokolü

1. Her maliyet için fatura/sağlayıcı kullanım ekranı kaynak olarak belirtilir; gizli değer yazılmaz.
2. Değişken AI maliyeti ayrıca şu birimlerle izlenir: menü sayfası, çeviri dili, açıklama işi ve görsel.
3. Maliyet artışı, haftalık toplam bütçeyi veya aktif ücretli işletme başına hedefi aşarsa önce kota/limit gözden geçirilir; kullanıcı fiyatı ancak gerçek birim ekonomiyle değiştirilir.
4. Ödeme, üretim veya kimlik doğrulama engeli varsa gelir tahmini "doğrulanmamış" sayılır.
5. Her haftalık incelemede bir satır eklenir: değişiklik, risk, karar sahibi ve sonraki kontrol tarihi.

## İlk maliyet kararları

- Anonim kullanıcıların pahalı AI yetenekleri sınırsız olmamalı; günlük kota zorlaması release ön şartıdır.
- Görsel üretimi Pro değerine bağlanmalı; ücretsiz kullanımda maliyet tavanı olmalı.
- İlk fiyat kararı, gerçek `AI maliyeti / aktif işletme` ve ödeme komisyonu görülmeden büyütülmemeli.
- Ürünü ölçeklemeden önce 10–20 ücretli/indirimli pilotla destek maliyeti ve aktivasyon süresi ölçülmeli.
