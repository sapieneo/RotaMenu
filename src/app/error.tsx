'use client';

import { useEffect } from 'react';

/**
 * Route seviyesinde hata sınırı. Beklenmeyen bir sunucu/render hatasında
 * kullanıcı boş ya da İngilizce bir ekranla kalmasın; "tekrar dene" ve
 * ana sayfa çıkışı sunulur.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Netlify fonksiyon loglarında iz bırakır — digest ile eşleştirilebilir.
    console.error('Beklenmeyen hata:', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl" aria-hidden>
        ⚠️
      </span>
      <h1 className="text-2xl font-bold text-stone-900">Bir şeyler ters gitti</h1>
      <p className="text-stone-600">
        Beklenmeyen bir hata oluştu. Sayfayı yeniden denemek çoğu zaman yeterli olur.
      </p>
      {error.digest && (
        <p className="text-xs text-stone-400">
          Hata kodu: <code className="rounded bg-stone-100 px-1">{error.digest}</code>
        </p>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-brand-700"
        >
          Tekrar dene
        </button>
        <a
          href="/"
          className="rounded-xl border border-stone-300 px-6 py-3 font-semibold text-stone-700 transition hover:bg-stone-50"
        >
          Ana sayfa
        </a>
      </div>
    </main>
  );
}
