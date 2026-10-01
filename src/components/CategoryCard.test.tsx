import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryCard } from './CategoryCard';

describe('CategoryCard', () => {
  it('requests a 600px Unsplash image, lazily', () => {
    render(
      <CategoryCard title="Diwali Decor" description="d" image="https://images.unsplash.com/photo-cat" icon="🪔" slug="diwali-decor" />,
    );
    const img = screen.getByRole('img', { name: 'Diwali Decor' });
    expect(img.getAttribute('src')).toContain('w=600');
    expect(img).toHaveAttribute('loading', 'lazy');
  });
});
