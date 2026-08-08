'use client';

/**
 * Kök layout'un kendisi patlarsa devreye giren son çare. Kendi <html>/<body>
 * etiketlerini sağlamak ZORUNDA (kök layout render edilemediği için) ve
 * globals.css yüklenmemiş olabileceğinden stiller satır içi verilir.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          background: '#fafaf9',
          color: '#1c1917',
        }}
      >
        <main style={{ maxWidth: '28rem', padding: '0 1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }} aria-hidden>
            ⚠️
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1rem' }}>
            Bir şeyler ters gitti
          </h1>
          <p style={{ color: '#57534e', marginTop: '0.5rem', lineHeight: 1.6 }}>
            Uygulama beklenmedik bir hatayla karşılaştı. Lütfen tekrar dene.
          </p>
          {error.digest && (
            <p style={{ color: '#a8a29e', fontSize: '0.75rem', marginTop: '0.75rem' }}>
              Hata kodu: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: '#ea580c',
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
