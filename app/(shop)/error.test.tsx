import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorPage from './error';

describe('storefront error boundary', () => {
  it('shows a message instead of a blank page and retries on demand', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    render(<ErrorPage error={new Error('Failed to load products')} reset={reset} />);

    expect(screen.getByText('Something went wrong loading this page.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
