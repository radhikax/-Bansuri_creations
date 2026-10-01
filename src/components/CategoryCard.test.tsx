import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryCard } from './CategoryCard';

describe('CategoryCard', () => {
  it('renders the image with the card sizes hint', () => {
    render(
      <CategoryCard title="Diwali Decor" description="d" image="https://images.unsplash.com/photo-cat" icon="🪔" slug="diwali-decor" />,
    );
    const img = screen.getByRole('img', { name: 'Diwali Decor' });
    expect(img.getAttribute('src')).toBe('https://images.unsplash.com/photo-cat');
    expect(img).toHaveAttribute('sizes', '(min-width:1024px) 25vw, (min-width:768px) 50vw, 100vw');
  });
});
