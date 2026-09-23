import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  AdminApiError,
  getAdminOrders,
  updateAdminOrderStatus,
  type AdminOrder,
  type AdminSettableOrderStatus,
  type OrderStatus,
} from '../lib/adminApi';

const STATUS_FILTERS: (OrderStatus | 'ALL')[] = ['ALL', 'PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const SETTABLE_STATUSES: AdminSettableOrderStatus[] = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export function OrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');

  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', statusFilter],
    queryFn: () => getAdminOrders(statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminSettableOrderStatus }) => updateAdminOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Order updated');
    },
    onError: (error) => toast.error(error instanceof AdminApiError ? error.message : 'Could not update order'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl">Orders</h1>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus | 'ALL')}>
          <SelectTrigger className="w-48" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((status) => (
              <SelectItem key={status} value={status}>{status === 'ALL' ? 'All statuses' : status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ordersQuery.isPending ? (
        <p className="text-muted-foreground">Loading orders…</p>
      ) : ordersQuery.isError ? (
        <p className="text-destructive">Couldn't load orders, please try again.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Update status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordersQuery.data?.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onStatusChange={(status) => statusMutation.mutate({ id: order.id, status })}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function OrderRow({ order, onStatusChange }: { order: AdminOrder; onStatusChange: (status: AdminSettableOrderStatus) => void }) {
  return (
    <TableRow>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell>{order.customerName}</TableCell>
      <TableCell>₹{order.total}</TableCell>
      <TableCell><Badge variant="secondary">{order.status}</Badge></TableCell>
      <TableCell className="text-right">
        <Select value="" onValueChange={(value) => onStatusChange(value as AdminSettableOrderStatus)}>
          <SelectTrigger className="w-40 ml-auto" aria-label={`Change status for ${order.orderNumber}`}>
            <SelectValue placeholder="Change status" />
          </SelectTrigger>
          <SelectContent>
            {SETTABLE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
}
