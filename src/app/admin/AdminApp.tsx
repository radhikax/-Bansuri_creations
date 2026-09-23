import { Route, Routes } from 'react-router-dom';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createAdminQueryClient } from './lib/queryClient';
import { AdminLayout } from './AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { SettingsPage } from './pages/SettingsPage';

const defaultQueryClient = createAdminQueryClient();

interface AdminAppProps {
  queryClient?: QueryClient;
}

export default function AdminApp({ queryClient = defaultQueryClient }: AdminAppProps = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}
