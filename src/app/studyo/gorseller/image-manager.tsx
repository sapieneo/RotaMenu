'use client';

import { useEffect, useRef, useState } from 'react';
import { PhoneFrame, PhoneScaledContent } from '@/components/phone-frame';

export type ImgItem = { id: string; name: string; imageUrl: string | null };
export type BackgroundStyle = 'strip' | 'hero';
export type ImgCategory = {
  id: string;
  name: string;
  backgroundUrl: string | null;
  backgroundStyle: BackgroundStyle;
  /** Görselin dikey kadrajı: 0 = üst, 50 = orta (varsayılan), 100 = alt. */
  backgroundPositionY: number;
  items: ImgItem[];
};

type Kind = 'item' | 'category';
type Busy = 'gen' | 'upload' | 'enhance' | 'remove' | null;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export function ImageManager({
  venueId,
  slug,
  categories,
}: {
  venueId: string;
  slug: string;
  categories: ImgCategory[];
}) {
  const [cats, setCats] = useState<ImgCategory[]>(categories);
  const [busy, setBusy] = useState<Record<string, Busy>>({});
  const [err, setErr] = useState<Record<string, string | null>>({});
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const enhanceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const totalItems = cats.reduce((n, c) => n + c.items.length, 0);
  const itemsWithImg = cats.reduce((n, c) => n + c.items.filter((i) => i.imageUrl).length, 0);

  function setUrl(kind: Kind, id: string, url: string | null) {
    setCats((cs) =>
      cs.map((c) => {
        if (kind === 'category') return c.id === id ? { ...c, backgroundUrl: url } : c;
        return { ...c, items: c.items.map((it) => (it.id === id ? { ...it, imageUrl: url } : it)) };
      })
    );
  }
  const mark = (id: string, b: Busy) => setBusy((s) => ({ ...s, [id]: b }));
  const fail = (id: string, m: string | null) => setErr((s) => ({ ...s, [id]: m }));
  const bodyId = (kind: Kind, id: string) => (kind === 'item' ? { itemId: id } : { categoryId: id });

  async function uploadFile(kind: Kind, id: string, file: File, temporary = false) {
    const form = new FormData();
    form.set('file', file);
    form.set(kind === 'item' ? 'itemId' : 'categoryId', id);
    if (temporary) form.set('temporary', 'true');
    const res = await fetch('/api/image/upload', { method: 'POST', body: form });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? 'Yükleme başarısız.');
    return body.imageUrl as string;
  }

  async function generate(kind: Kind, id: string) {
    mark(id, 'gen');
    fail(id, null);
    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyId(kind, id)),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Görsel üretilemedi.');
      setUrl(kind, id, `${body.imageUrl}?t=${Date.now()}`);
    } catch (e) {
      fail(id, e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      mark(id, null);
    }
  }

  async function upload(kind: Kind, id: string, file: File) {
    if (!ACCEPTED.includes(file.type)) return fail(id, 'JPG, PNG veya WebP yükleyin.');
    if (file.size > MAX_BYTES) return fail(id, 'Görsel 10 MB sınırını aşıyor.');
    mark(id, 'upload');
    fail(id, null);
    try {
      const publicUrl = await uploadFile(kind, id, file);
      const res = await fetch('/api/image', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bodyId(kind, id), imageUrl: publicUrl }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Görsel bağlanamadı.');
      setUrl(kind, id, `${publicUrl}?t=${Date.now()}`);
    } catch (e) {
      fail(id, e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      mark(id, null);
    }
  }

  async function enhance(kind: Kind, id: string, file: File) {
    if (!ACCEPTED.includes(file.type)) return fail(id, 'JPG, PNG veya WebP yükleyin.');
    if (file.size > MAX_BYTES) return fail(id, 'Görsel 10 MB sınırını aşıyor.');
    mark(id, 'enhance');
    fail(id, null);
    try {
      const publicUrl = await uploadFile(kind, id, file, true);
      const res = await fetch('/api/image/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bodyId(kind, id), sourceUrl: publicUrl }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'İyileştirilemedi.');
      setUrl(kind, id, `${body.imageUrl}?t=${Date.now()}`);
    } catch (e) {
      fail(id, e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      mark(id, null);
    }
  }

  async function remove(kind: Kind, id: string) {
    mark(id, 'remove');
    fail(id, null);
    try {
      const res = await fetch('/api/image', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bodyId(kind, id), imageUrl: null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Kaldırılamadı.');
      setUrl(kind, id, null);
    } catch (e) {
      fail(id, e instanceof Error ? e.message : 'Beklenmeyen hata.');
    } finally {
      mark(id, null);
    }
  }

  function Controls({ kind, id, hasImage }: { kind: Kind; id: string; hasImage: boolean }) {
    const b = busy[id] ?? null;
    const working = b !== null;
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => generate(kind, id)}
            disabled={working}
            className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {b === 'gen' ? 'Üretiliyor…' : hasImage ? '↻ Yeniden üret' : '✨ AI ile üret'}
          </button>
          <button
            onClick={() => uploadRefs.current[id]?.click()}
            disabled={working}
            className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            {b === 'upload' ? 'Yükleniyor…' : 'Elle yükle'}
          </button>
          <button
            onClick={() => enhanceRefs.current[id]?.click()}
            disabled={working}
            title="Yüklediğin fotoğrafı keskinleştirip yükler"
            className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            {b === 'enhance' ? 'İyileştiriliyor…' : '✨ İyileştir ve yükle'}
          </button>
          {hasImage && (
            <button
              onClick={() => remove(kind, id)}
              disabled={working}
              className="rounded-lg px-2 py-1 text-xs font-medium text-stone-400 transition hover:text-red-600 disabled:opacity-50"
            >
              Kaldır
            </button>
          )}
        </div>
        <input
          ref={(el) => {
            uploadRefs.current[id] = el;
          }}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(kind, id, f);
            e.target.value = '';
          }}
        />
        <input
          ref={(el) => {
            enhanceRefs.current[id] = el;
          }}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enhance(kind, id, f);
            e.target.value = '';
          }}
        />
        {err[id] && <p className="mt-1 text-xs text-red-600">{err[id]}</p>}
      </>
    );
  }

  if (totalItems === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Görseller</h1>
          <p className="mt-2 text-stone-500">Menünde görsel eklenecek ürün yok.</p>
          <a
            href={`/studyo/pano?venue=${encodeURIComponent(venueId)}`}
            className="mt-4 inline-block rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            ← Panoya dön
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-600">Görseller</p>
          <h1 className="mt-1 text-2xl font-bold">Menü görselleri</h1>
          <p className="mt-1 text-sm text-stone-500">
            {itemsWithImg} / {totalItems} üründe görsel var. Ürün görseli ve kategori arka planı için
            AI ile üret, yeniden üret ya da kendi fotoğrafını yükle.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={`/m/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            👁 Misafir menüsünü önizle
          </a>
          <a
            href={`/studyo/pano?venue=${encodeURIComponent(venueId)}`}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            ← Panoya dön
          </a>
        </div>
      </header>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] xl:justify-between">
      <div className="min-w-0 max-w-2xl space-y-6">
        {cats.map((c) => (
          <section key={c.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            {/* Kategori görseli — GERİ GELDİ.
                Daha önce kaldırılmıştı çünkü misafir menüsü kategorileri düz
                editoryal başlıklarla ayırıyordu ve yüklenen görsel hiçbir yerde
                görünmüyordu. Artık misafir menüsünde "görselli kategori
                butonları" ızgarası var (guest-menu.tsx → CategoryGrid), yani
                bu görsel doğrudan ana sayfada kullanılıyor. */}
            <div className="mb-4 border-b border-stone-100 pb-3">
              <div className="flex items-start gap-3">
                <div
                  role={c.backgroundUrl ? 'button' : undefined}
                  tabIndex={c.backgroundUrl ? 0 : undefined}
                  aria-label={c.backgroundUrl ? `${c.name} görselini büyüt` : undefined}
                  onClick={() => c.backgroundUrl && setLightbox({ url: c.backgroundUrl, alt: c.name })}
                  onKeyDown={(e) => {
                    if (!c.backgroundUrl) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setLightbox({ url: c.backgroundUrl, alt: c.name });
                    }
                  }}
                  className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-50"
                >
                  {c.backgroundUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.backgroundUrl}
                      alt={c.name}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: `center ${c.backgroundPositionY}%` }}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] text-stone-400">
                      görsel yok
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-stone-800">{c.name}</h2>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {c.items.length} ürün · kategori görseli misafir menüsünün ana sayfasında buton olarak görünür
                  </p>
                  <div className="mt-2">
                    <Controls kind="category" id={c.id} hasImage={Boolean(c.backgroundUrl)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Ürünler */}
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {c.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  {/* Sarmalayıcı <div> OLMALI — bkz. kategori arka planındaki
                      not: <button> içinde h-full çözülmüyor, görsel kayboluyor. */}
                  <div
                    role={it.imageUrl ? 'button' : undefined}
                    tabIndex={it.imageUrl ? 0 : undefined}
                    aria-label={it.imageUrl ? `${it.name} görselini büyüt` : undefined}
                    onClick={() => it.imageUrl && setLightbox({ url: it.imageUrl, alt: it.name })}
                    onKeyDown={(e) => {
                      if (!it.imageUrl) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setLightbox({ url: it.imageUrl, alt: it.name });
                      }
                    }}
                    className={`group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100 ${it.imageUrl ? 'cursor-zoom-in' : ''}`}
                  >
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.imageUrl}
                        alt={it.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl text-stone-300">
                        🍽
                      </span>
                    )}
                    {busy[it.id] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-stone-800">{it.name}</p>
                    <div className="mt-1.5">
                      <Controls kind="item" id={it.id} hasImage={Boolean(it.imageUrl)} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Canlı önizleme</p>
            <p className="mt-0.5 text-xs text-stone-500">Değişiklikler anında görünür — gerçek misafir menünle birebir aynı</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Canlı</span>
        </div>
        <LivePreview slug={slug} categories={cats} />
      </aside>
      </div>

      {lightbox && <Lightbox url={lightbox.url} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </main>
  );
}

/** Küçük görsele tıklayınca büyük halini gösteren tam ekran önizleme. */
function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/**
 * Sağdaki maket — gerçek /m/[slug] misafir menü sayfasını iframe içinde
 * gösterir (Tasarım Stüdyosu'ndaki teknikle aynı, bkz. studyo/tasarim/
 * design-studio.tsx → LivePreview). Iframe yalnızca BİR KEZ yüklenir;
 * kategori arka planı / ürün görseli değişince tam yeniden yükleme yerine
 * `postMessage` ile guest-menu.tsx'e iletilir — bu yüzden gerçekten anında
 * yansır (görsel üretimi/yükleme sırasındaki gecikme dışında).
 */
function LivePreview({ slug, categories }: { slug: string; categories: ImgCategory[] }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [src] = useState(() => `/m/${slug}`);

  function sendPreview() {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'ros:categories-preview',
        categories: categories.map((c) => ({
          id: c.id,
          backgroundUrl: c.backgroundUrl,
          backgroundStyle: c.backgroundStyle,
          backgroundPositionY: c.backgroundPositionY,
          items: c.items.map((it) => ({ id: it.id, imageUrl: it.imageUrl })),
        })),
      },
      window.location.origin
    );
  }

  useEffect(() => {
    sendPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  return (
    <PhoneFrame>
      <PhoneScaledContent>
        <iframe ref={iframeRef} src={src} title="Menü canlı önizleme" className="h-full w-full border-0" onLoad={sendPreview} />
      </PhoneScaledContent>
    </PhoneFrame>
  );
}
