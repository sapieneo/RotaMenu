/**
 * Global 404. QR ile dağıtılan bir üründe yanlış yazılmış/eski bir adres sık
 * görülür; misafir markasız ve İngilizce bir Next.js varsayılanıyla
 * karşılaşmasın diye burada Türkçe, çıkış yolu olan bir ekran veriyoruz.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl" aria-hidden>
        🍽
      </span>
      <h1 className="text-2xl font-bold text-stone-900">Bu sayfa bulunamadı</h1>
      <p className="text-stone-600">
        Aradığın menü taşınmış, kaldırılmış ya da adres yanlış yazılmış olabilir. QR kodu
        okuttuysan lütfen tekrar dene veya işletmeden güncel menü bağlantısını iste.
      </p>
      <a
        href="/"
        className="mt-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-brand-700"
      >
        Ana sayfaya dön
      </a>
    </main>
  );
}
