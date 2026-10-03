import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('lists the categories it is given', () => {
    render(
      <Footer categories={[{ title: 'Kanha Dresses', description: '', image: '', icon: '', slug: 'kanha-dresses' }]} />,
    );
    expect(screen.getByRole('link', { name: 'Kanha Dresses' })).toHaveAttribute('href', '/category/kanha-dresses');
    expect(screen.queryByRole('link', { name: 'Wedding Packing' })).not.toBeInTheDocument();
  });
});
