import type { Metadata } from 'next';
import { AdminShell } from '@/admin/AdminShell';

// The admin panel must never be indexed, and it sits outside the (shop)
// route group — see the controller ruling in the Task 8 brief: it does not
// get the storefront chrome and must not call the catalogue API.
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
