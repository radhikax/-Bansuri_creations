import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

describe('Footer', () => {
  it('lists the categories it is given', () => {
    render(
      <MemoryRouter>
        <Footer categories={[{ title: 'Kanha Dresses', description: '', image: '', icon: '', slug: 'kanha-dresses' }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Kanha Dresses' })).toHaveAttribute('href', '/category/kanha-dresses');
    expect(screen.queryByRole('link', { name: 'Wedding Packing' })).not.toBeInTheDocument();
  });
});
