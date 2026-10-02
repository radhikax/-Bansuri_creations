import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GlobalError from './global-error';

describe('root error boundary (global-error)', () => {
  it('shows a branded message instead of Next\'s default error screen and retries on demand', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    render(<GlobalError error={new Error('Root layout blew up')} reset={reset} />);

    expect(screen.getByText('Something went wrong loading this page.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
