import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Reveal } from './Reveal';

// The prefers-reduced-motion branch isn't unit-tested: motion reads that preference once
// at module load, so it can't be toggled per test.
describe('Reveal', () => {
  it('renders its children with the given className', () => {
    render(<Reveal className="box">hello</Reveal>);
    expect(screen.getByText('hello')).toHaveClass('box');
  });

  it('starts hidden until it scrolls into view', () => {
    render(<Reveal>later</Reveal>);
    expect(screen.getByText('later')).toHaveStyle({ opacity: '0' });
  });
});
