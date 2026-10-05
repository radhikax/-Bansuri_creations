'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAdminQueryClient } from './lib/queryClient';
import { AdminLayout } from './AdminLayout';

// The client boundary for everything under /admin: owns the QueryClient whose
// central 401 handler redirects to the login page (lib/queryClient.ts), and
// decides whether a route gets the AdminLayout chrome (nav + logout + the
// settings bootstrap check) or renders bare — the login page itself must not
// be gated behind the same bootstrap check it exists to get past.
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [queryClient] = useState(() => createAdminQueryClient(() => router.replace('/admin/login')));

  return (
    <QueryClientProvider client={queryClient}>
      {pathname === '/admin/login' ? children : <AdminLayout>{children}</AdminLayout>}
    </QueryClientProvider>
  );
}
