import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAdminQueryClient } from '../app/admin/lib/queryClient';

export function renderAdminPage(ui: ReactNode, initialEntries: string[] = ['/admin']) {
  const queryClient = createAdminQueryClient(() => {});
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
    queryClient,
  };
}
