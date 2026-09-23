import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { AdminApiError, getStoreSettings, updateStoreSettings } from '../lib/adminApi';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['admin', 'settings'], queryFn: getStoreSettings });

  const [flatShippingFee, setFlatShippingFee] = useState<number | string>('');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | string>('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setFlatShippingFee(settingsQuery.data.flatShippingFee);
      setFreeShippingThreshold(settingsQuery.data.freeShippingThreshold);
    }
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateStoreSettings({
        flatShippingFee: typeof flatShippingFee === 'number' ? flatShippingFee : Number(flatShippingFee),
        freeShippingThreshold: typeof freeShippingThreshold === 'number' ? freeShippingThreshold : Number(freeShippingThreshold),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'settings'], updated);
      setFormError(null);
      toast.success('Settings saved');
    },
    onError: (error) => {
      setFormError(error instanceof AdminApiError ? error.message : 'Could not save settings');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  if (settingsQuery.isPending) {
    return <p className="text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-2xl mb-6">Shipping settings</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="flatShippingFee">Flat shipping fee (₹)</Label>
          <Input
            id="flatShippingFee"
            type="number"
            min="0"
            value={String(flatShippingFee)}
            onChange={(e) => setFlatShippingFee(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="freeShippingThreshold">Free shipping threshold (₹)</Label>
          <Input
            id="freeShippingThreshold"
            type="number"
            min="0"
            value={String(freeShippingThreshold)}
            onChange={(e) => setFreeShippingThreshold(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </div>
  );
}
