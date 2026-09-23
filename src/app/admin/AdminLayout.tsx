import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminLogout, getStoreSettings } from './lib/adminApi';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
];

export function AdminLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Same query key as SettingsPage's own read (Task 4), so they share one
  // cache entry instead of two redundant fetches of the same resource.
  const bootstrap = useQuery({ queryKey: ['admin', 'settings'], queryFn: getStoreSettings });

  const handleLogout = async () => {
    await adminLogout();
    queryClient.clear();
    navigate('/admin/login');
  };

  if (bootstrap.isPending) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  if (bootstrap.isError) {
    // A 401 here already triggered the central redirect via the QueryClient's
    // onError handler (lib/queryClient.ts) — render nothing while it happens.
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center gap-6">
            <span className="text-lg">Bansuri Admin</span>
            <nav className="flex items-center gap-6">
              {NAV_ITEMS.map((item) => (
                <Link key={item.to} to={item.to} className="text-sm hover:text-primary transition-colors">
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
        <Outlet />
      </main>
    </div>
  );
}
