import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAdminQueryClient } from '../admin/lib/queryClient';

export function renderAdminPage(ui: ReactNode) {
  const queryClient = createAdminQueryClient(() => {});
  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  };
}
