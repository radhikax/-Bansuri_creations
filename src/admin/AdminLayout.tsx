import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminLogout, getStoreSettings, AdminUnauthorizedError } from './lib/adminApi';
import { Button } from '../components/ui/button';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/settings', label: 'Settings' },
];

export function AdminLayout({ children }: { children?: ReactNode } = {}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  // Same query key as SettingsPage's own read (Task 4), so they share one
  // cache entry instead of two redundant fetches of the same resource.
  const bootstrap = useQuery({ queryKey: ['admin', 'settings'], queryFn: getStoreSettings });

  const handleLogout = async () => {
    await adminLogout();
    queryClient.clear();
    router.push('/admin/login');
  };

  if (bootstrap.isPending) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  if (bootstrap.isError) {
    if (bootstrap.error instanceof AdminUnauthorizedError) {
      // A 401 here already triggered the central redirect via the QueryClient's
      // onError handler (lib/queryClient.ts) — render nothing while it happens.
      return null;
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Couldn't load the admin panel, please try again.</p>
        <Button onClick={() => bootstrap.refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4">
          {/* Wraps below lg: title and Log out share the first row, the nav
              links drop to a second row so the header never scrolls sideways. */}
          <div className="flex min-h-16 flex-wrap items-center gap-x-6 gap-y-2 py-3">
            <span className="text-lg">Bansuri Admin</span>
            <nav className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-2 lg:order-none lg:w-auto lg:gap-x-6">
              {NAV_ITEMS.map((item) => (
                <Link key={item.to} href={item.to} className="text-sm hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={handleLogout}
              className="ml-auto text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
