import { useQuery } from '@tanstack/react-query';
import { getAdminOrders, getAdminProducts } from '../lib/adminApi';

export function DashboardPage() {
  const products = useQuery({ queryKey: ['admin', 'products'], queryFn: getAdminProducts });
  const pendingOrders = useQuery({ queryKey: ['admin', 'orders', 'PENDING'], queryFn: () => getAdminOrders('PENDING') });

  return (
    <div>
      <h1 className="text-2xl mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
        <div className="rounded-lg border p-6">
          <div className="text-sm text-muted-foreground mb-1">Total products</div>
          <div className="text-3xl">{products.data?.length ?? '—'}</div>
        </div>
        <div className="rounded-lg border p-6">
          <div className="text-sm text-muted-foreground mb-1">Pending orders</div>
          <div className="text-3xl">{pendingOrders.data?.length ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
