'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sheet } from '@/components/ui/sheet';
import { Pressable } from '@/components/ui/pressable';
import { Icon } from '@/components/ui/icon';

/**
 * AJANS MODU — "Menü üret".
 *
 * Süper-admin bir müşteri için sıfırdan işletme açar; plan doğrudan 'pro'
 * kurulur (görsel üretimi, sınırsız dil, yayın ilk saniyeden açık) ve stüdyonun
 * 1. adımına düşülür.
 *
 * İSİM NEDEN BAŞTA SORULUYOR: normal kayıt akışı her işletmeyi "İşletmem" diye
 * açıyor ve veritabanı bu isimden altı tane biriktirmiş durumda. Ajans
 * tarafında müşteri adı zaten belli, baştan yazmak hem bir adım kazandırıyor
 * hem de menü adresini (slug) anlamlı yapıyor.
 *
 * SUPABASE OTURUMU: org sahipliği gerçek bir Supabase kullanıcısına bağlanmak
 * zorunda (bkz. api/admin/venue/create). Admin çerezi tek başına yetmez, o
 * yüzden istek öncesi oturum garantiye alınır.
 */
export function CreateVenueButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('İşletme adı en az 2 karakter olmalı.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Sahiplik için Supabase oturumu şart — yoksa aç.
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw new Error('Stüdyo oturumu açılamadı.');
      }

      const res = await fetch('/api/admin/venue/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'İşletme oluşturulamadı.');

      // Doğrudan 1. adıma: menü fotoğrafını yükle.
      window.location.href = `/studyo?venue=${encodeURIComponent(body.venueId)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beklenmeyen hata.');
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        onClick={() => setOpen(true)}
        className="inline-flex min-h-touch items-center gap-sm rounded-pill bg-brand-600 px-md text-footnote font-semibold text-white transition hover:bg-brand-700"
      >
        <Icon name="plus" size={18} />
        Menü üret
      </Pressable>

      <Sheet
        open={open}
        onClose={() => {
          if (busy) return;
          setOpen(false);
          setError(null);
        }}
        label="Yeni işletme için menü üret"
        placement="center"
        panelClassName="w-full max-w-sm rounded-panel bg-surface-raised p-lg shadow-2xl"
      >
        <h3 className="text-heading font-semibold text-content">Menü üret</h3>
        <p className="mt-sm text-footnote text-content-secondary">
          Müşteri için yeni bir işletme açılır ve <strong className="text-content">Pro</strong>{' '}
          haklarıyla başlar — görsel üretimi, sınırsız dil ve yayın açık olur. Ardından menü
          yükleme adımına geçersin.
        </p>

        <label className="mt-md block">
          <span className="mb-xs block text-footnote font-medium text-content-secondary">
            İşletme adı
          </span>
          <input
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && !busy && void create()}
            placeholder="Çiçek Lokantası"
            className="min-h-touch w-full rounded-card border border-line-strong bg-surface px-md text-footnote text-content outline-none focus:border-brand-500"
          />
        </label>

        {error && <p className="mt-sm text-caption font-medium text-red-600">{error}</p>}

        <div className="mt-md flex justify-end gap-sm">
          <Pressable
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            disabled={busy}
            className="min-h-touch rounded-pill border border-line-strong px-md text-footnote font-medium text-content"
          >
            Vazgeç
          </Pressable>
          <Pressable
            onClick={() => void create()}
            disabled={busy || name.trim().length < 2}
            className="min-h-touch rounded-pill bg-brand-600 px-md text-footnote font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Oluşturuluyor…' : 'Oluştur ve menü yükle'}
          </Pressable>
        </div>
      </Sheet>
    </>
  );
}
