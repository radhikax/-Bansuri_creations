import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GlobalError from './global-error';

describe('root error boundary (global-error)', () => {
  it('shows a branded message instead of Next\'s default error screen and retries on demand', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = vi.fn();
    render(<GlobalError error={new Error('Root layout blew up')} retry={retry} />);

    expect(screen.getByText('Something went wrong loading this page.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('applies the brand font variables, since the root layout is not rendered', () => {
    // The returned element is the <html> itself (rendering it inside RTL's <div> would lose it).
    const html = GlobalError({ error: new Error('x'), retry: vi.fn() });

    expect(html.type).toBe('html');
    expect(html.props.className).toContain('font-heading-var');
    expect(html.props.className).toContain('font-body-var');
  });
});
