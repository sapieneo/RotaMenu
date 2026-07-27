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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-medium text-brand-600">RestaurantOS</p>
        <h1 className="mt-1 text-2xl font-bold">Kontrol paneli</h1>
        <p className="mt-1 text-sm text-stone-500">Yalnız yönetici erişimi.</p>
      </div>
      <AdminLoginForm />
    </main>
  );
}
