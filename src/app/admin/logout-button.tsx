'use client';

export function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin';
      }}
      className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
    >
      Çıkış
    </button>
  );
}
