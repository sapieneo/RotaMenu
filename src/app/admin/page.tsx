import { redirect } from 'next/navigation';
import { isAdminSession } from '@/lib/admin-auth';
import { AdminLoginForm } from './admin-login-form';

export const dynamic = 'force-dynamic';

/**
 * Süper-admin kontrol paneli girişi. Supabase auth'tan bağımsız, tek şifreli
 * (ADMIN_PASSWORD) basit giriş — bkz. lib/admin-auth.ts.
 */
export default function AdminLoginPage() {
  if (isAdminSession()) redirect('/admin/panel');

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-lg px-md">
      <div>
        <p className="text-footnote font-semibold tracking-tight text-content">
          Rota<span className="text-brand-600">Menu</span>
        </p>
        <h1 className="mt-xs text-title font-semibold text-content">Kontrol paneli</h1>
        <p className="mt-xs text-footnote text-content-secondary">Yalnız yönetici erişimi.</p>
      </div>
      <AdminLoginForm />
    </main>
  );
}
