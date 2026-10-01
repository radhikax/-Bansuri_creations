import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ShimmerImage } from './ShimmerImage';

describe('ShimmerImage', () => {
  it('shows a shimmer and hides the image until it loads', () => {
    const { container } = render(<ShimmerImage src="a.jpg" alt="pic" />);
    expect(container.querySelector('.shimmer')).toBeInTheDocument();
    expect(screen.getByAltText('pic')).toHaveClass('opacity-0');
  });

  it('reveals the image and calls onLoad once loaded', () => {
    const onLoad = vi.fn();
    const { container } = render(<ShimmerImage src="a.jpg" alt="pic" onLoad={onLoad} />);
    fireEvent.load(screen.getByAltText('pic'));
    expect(container.querySelector('.shimmer')).not.toBeInTheDocument();
    expect(screen.getByAltText('pic')).not.toHaveClass('opacity-0');
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('stops the shimmer and calls onError when loading fails', () => {
    const onError = vi.fn();
    const { container } = render(<ShimmerImage src="bad.jpg" alt="pic" onError={onError} />);
    fireEvent.error(screen.getByAltText('pic'));
    expect(container.querySelector('.shimmer')).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('merges a custom className', () => {
    render(<ShimmerImage src="a.jpg" alt="pic" className="rounded" />);
    expect(screen.getByAltText('pic')).toHaveClass('rounded');
  });
});
