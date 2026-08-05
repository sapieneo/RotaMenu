'use client';

import { useState } from 'react';

/**
 * "Menünüzü biz kuralım" — telefon bırakma formu.
 * Teknik olmayan işletmeci için en düşük sürtünmeli giriş noktası: uygulamaya
 * hiç girmeden numara bırakır, biz ararız.
 */
export function SetupRequestForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/setup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Gönderilemedi.');
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Gönderilemedi.');
    }
  }

  if (status === 'done') {
    return (
      <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        ✓ Teşekkürler! En kısa sürede sizi arayacağız.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-start gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="İşletme adı"
        required
        className="min-w-[150px] flex-1 rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="0555 555 55 55"
        inputMode="tel"
        required
        className="min-w-[150px] flex-1 rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
      >
        {status === 'sending' ? 'Gönderiliyor…' : 'Beni arayın'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
