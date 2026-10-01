import { usePathname } from 'next/navigation';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createAdminQueryClient } from './lib/queryClient';
import { AdminLayout } from './AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ProductsPage } from './pages/ProductsPage';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { Toaster } from '../components/ui/sonner';

const defaultQueryClient = createAdminQueryClient();

interface AdminAppProps {
  queryClient?: QueryClient;
}

// Routed by pathname rather than react-router's <Routes>/<Route>/<Outlet>,
// since react-router-dom is gone as of Task 3. Task 8 replaces this whole
// component with real Next.js file-system routes under /admin.
export default function AdminApp({ queryClient = defaultQueryClient }: AdminAppProps = {}) {
  const pathname = usePathname();

  const page = (() => {
    switch (pathname) {
      case '/admin/login':
        return 'login';
      case '/admin/products':
        return 'products';
      case '/admin/categories':
        return 'categories';
      case '/admin/orders':
        return 'orders';
      case '/admin/settings':
        return 'settings';
      default:
        return 'dashboard';
    }
  })();

  return (
    <QueryClientProvider client={queryClient}>
      {page === 'login' ? (
        <LoginPage />
      ) : (
        <AdminLayout>
          {page === 'products' && <ProductsPage />}
          {page === 'categories' && <CategoriesPage />}
          {page === 'orders' && <OrdersPage />}
          {page === 'settings' && <SettingsPage />}
          {page === 'dashboard' && <DashboardPage />}
        </AdminLayout>
      )}
      <Toaster />
    </QueryClientProvider>
  );
}
