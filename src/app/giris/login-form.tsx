'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Status =
  | { name: 'idle' }
  | { name: 'sending' }
  | { name: 'sent'; email: string }
  | { name: 'error'; message: string };

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ name: 'idle' });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value) return setStatus({ name: 'error', message: 'E-posta adresini yaz.' });

    setStatus({ name: 'sending' });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: {
          // KRİTİK: false → bu sayfa yeni hesap AÇMAZ. Kayıt olmamış bir
          // e-posta girilirse Supabase 'signups not allowed' döner; aşağıda
          // bunu "bu e-posta kayıtlı değil" mesajına çeviriyoruz. Böylece
          // kullanıcı yanlışlıkla ikinci bir boş hesap yaratmaz.
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/studyo/pano`,
        },
      });
      if (error) throw error;
      setStatus({ name: 'sent', email: value });
    } catch (err) {
      setStatus({ name: 'error', message: friendlyMessage(err) });
    }
  }

  if (status.name === 'sent') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-semibold text-emerald-900">Bağlantı gönderildi ✓</p>
        <p className="mt-1 text-sm text-emerald-800">
          <strong>{status.email}</strong> adresine bir giriş bağlantısı yolladık. Bağlantıya
          tıkladığında panona düşeceksin.
        </p>
        <p className="mt-3 text-xs text-emerald-700">
          E-posta birkaç dakika içinde gelmezse spam klasörünü kontrol et.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ name: 'idle' })}
          className="mt-3 text-xs font-semibold text-emerald-900 underline"
        >
          Farklı bir e-posta dene
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-600">E-posta</span>
        <input
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status.name === 'error') setStatus({ name: 'idle' });
          }}
          placeholder="ornek@isletmem.com"
          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        />
      </label>

      {status.name === 'error' && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={status.name === 'sending'}
        className="w-full rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status.name === 'sending' ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}
      </button>
    </form>
  );
}

function friendlyMessage(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (raw.includes('signups not allowed') || raw.includes('user not found')) {
    return 'Bu e-posta ile kayıtlı bir hesap bulamadık. Adresi kontrol et ya da "Ücretsiz dene" ile başla.';
  }
  if (raw.includes('rate') || raw.includes('too many') || raw.includes('security purposes')) {
    return 'Çok sık denedin. Bir dakika bekleyip tekrar dene.';
  }
  if (raw.includes('invalid') && raw.includes('email')) return 'Geçerli bir e-posta adresi yaz.';
  return 'Bağlantı gönderilemedi. Birazdan tekrar dene.';
}
