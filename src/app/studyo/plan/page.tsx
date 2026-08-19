export const dynamic = 'force-dynamic';

/**
 * AJANS MODU: plan/yükseltme ekranı devre dışı.
 *
 * Bu kurulum dışarıya satılan bir SaaS değil; ajansın kendi müşterileri için
 * menü ürettiği kapalı bir ortam. Tüm plan kapıları kapalı (bkz. lib/plans.ts
 * → PLANS), dolayısıyla yükseltilecek bir şey yok ve fiyat/paket göstermek
 * yanıltıcı olur.
 *
 * Rota bilerek SİLİNMEDİ: kodun birkaç yerinde (yayın kartı, görseller sayfası,
 * ayarlar) hâlâ buraya bağlantı veren — ama artık ulaşılamayan — dallar var.
 * Rota dursun ki o dallardan biri beklenmedik şekilde tetiklenirse kullanıcı
 * 404 yerine anlamlı bir açıklama görsün. Faturalama altyapısı (iyzico
 * rotaları, plan-client.tsx) kodda duruyor; ileride tekrar SaaS'a dönülmek
 * istenirse bu dosyayı eski haline döndürmek yeterli.
 */
export default function PlanPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-4xl" aria-hidden>
        ✨
      </span>
      <h1 className="text-xl font-semibold">Tüm özellikler açık</h1>
      <p className="text-stone-600">
        Bu kurulumda plan, paket veya kullanım sınırı yok. Ürün sayısı, dil, görsel üretimi ve
        yayınlama dahil her şey sınırsız kullanılabilir — yükseltmeniz gereken bir şey yok.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <a
          href="/studyo/pano"
          className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-brand-700"
        >
          Panoya dön
        </a>
        <a
          href="/studyo"
          className="rounded-xl border border-stone-300 px-6 py-3 font-semibold text-stone-700 transition hover:bg-stone-50"
        >
          Menü yükle
        </a>
      </div>
    </main>
  );
}
