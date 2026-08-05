import { MarketingHeader, MarketingFooter } from './marketing-chrome';

/** Yasal metin sayfaları için ortak kabuk ve tipografi. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">{title}</h1>
        <p className="mt-2 text-sm text-stone-500">Son güncelleme: {updated}</p>
        <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed text-stone-700">
          {children}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-stone-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function List({ items }: { items: string[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}
