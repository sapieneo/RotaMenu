'use client';

import { useState } from 'react';

/**
 * Hesap gerektirmeyen pano girişi. `studyo/pano/page.tsx` bu venue için ne
 * oturum açmış bir org üyesi, ne süper-admin, ne de geçerli bir pano şifresi
 * çerezi bulamayınca bu ekranı gösterir. Doğru şifre (işletmenin kendi pano
 * şifresi VEYA yönetici parolası) girilince `/api/venue/pano-auth` bu venue
 * için imzalı bir çerez yazar; sayfayı yenileyip sunucu tarafında tekrar
 * kontrol ettiriyoruz.
 */
export function PanoPasswordGate({ venueId }: { venueId: string }) {
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!password.trim() || state === 'checking') return;
    setState('checking');
    setError(null);
    try {
      const response = await fetch('/api/venue/pano-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Şifre yanlış.');
      window.location.reload();
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Beklenmeyen hata.');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-3xl" aria-hidden>🔒</span>
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Pano şifresi gerekli</h1>
        <p className="mt-1.5 text-sm text-stone-500">
          Bu işletmenin panosunu görmek için işletmeye özel giriş şifresini gir.
        </p>
      </div>
      <div className="w-full">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void submit()}
          placeholder="Pano şifresi"
          className="w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-sm outline-none focus:border-brand-500"
        />
        {state === 'error' && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!password.trim() || state === 'checking'}
          className="mt-3 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === 'checking' ? 'Kontrol ediliyor…' : 'Giriş yap'}
        </button>
      </div>
    </main>
  );
}
