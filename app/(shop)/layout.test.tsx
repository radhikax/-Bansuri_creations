import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { getCategories } = vi.hoisted(() => ({
  getCategories: vi.fn(),
}));

// The layout is a Server Component that calls into src/lib/catalogue.ts
// (server-only, real network access). Mock it wholesale, as the route
// tests do, so this test exercises only the layout's own degrade-on-error
// behaviour.
vi.mock('@/lib/catalogue', () => ({ getCategories }));

import ShopLayout from './layout';

async function renderLayout() {
  const element = await ShopLayout({ children: <div>page content</div> });
  render(element);
}

describe('app/(shop)/layout', () => {
  it('renders the header, footer and page content with the live categories', async () => {
    getCategories.mockResolvedValue([
      { title: 'Diwali Decor', description: '', image: '', icon: '', slug: 'diwali-decor' },
    ]);

    await renderLayout();

    expect(screen.getAllByRole('link', { name: 'Diwali Decor' }).length).toBeGreaterThan(0);
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('degrades to an empty category list instead of throwing past (shop)/error.tsx when the fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getCategories.mockRejectedValue(new Error('API is down'));

    await renderLayout();

    // No category links, but the header, main content and footer still render.
    expect(screen.queryByRole('link', { name: /diwali decor/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });
});
