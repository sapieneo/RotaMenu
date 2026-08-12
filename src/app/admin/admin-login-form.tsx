'use client';

import { useState, type FormEvent } from 'react';
import { Pressable } from '@/components/ui/pressable';

export function AdminLoginForm() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Giriş başarısız.');
      window.location.href = '/admin/panel';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beklenmeyen hata.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-md">
      <label className="block">
        <span className="mb-xs block text-footnote font-medium text-content-secondary">Şifre</span>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          autoFocus
          className="min-h-touch w-full rounded-card border border-line-strong bg-surface-raised px-md text-footnote text-content outline-none focus:border-brand-500"
        />
      </label>
      {error && <p className="text-footnote text-red-600">{error}</p>}
      <Pressable
        type="submit"
        disabled={busy || !password}
        className="min-h-touch rounded-pill bg-brand-600 px-lg text-body font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? 'Giriş yapılıyor…' : 'Giriş'}
      </Pressable>
    </form>
  );
}
