import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './Hero';

describe('Hero', () => {
  it('links "Shop Now" to the featured products and "View Collections" to the categories', () => {
    render(<Hero />);
    expect(screen.getByRole('link', { name: 'Shop Now' })).toHaveAttribute('href', '#featured');
    expect(screen.getByRole('link', { name: 'View Collections' })).toHaveAttribute('href', '#categories');
  });

  it('renders "View Collections" as a transparent button with white text', () => {
    render(<Hero />);
    const link = screen.getByRole('link', { name: 'View Collections' });
    expect(link.className).toContain('bg-transparent');
    expect(link.className).toContain('text-white');
  });
});
