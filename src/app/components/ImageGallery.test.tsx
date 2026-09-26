import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageGallery } from './ImageGallery';

describe('ImageGallery', () => {
  it('renders the first image as the main image', () => {
    render(<ImageGallery images={['a.jpg', 'b.jpg']} alt="Diya" />);
    expect(screen.getByAltText('Diya')).toHaveAttribute('src', 'a.jpg');
  });

  it('renders no thumbnails for a single image', () => {
    render(<ImageGallery images={['a.jpg']} alt="Diya" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders one labelled thumbnail per image and swaps the main image on click', async () => {
    const user = userEvent.setup();
    render(<ImageGallery images={['a.jpg', 'b.jpg', 'c.jpg']} alt="Diya" />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await user.click(screen.getByAltText('Diya thumbnail 3').closest('button')!);
    await waitFor(() =>
      expect(screen.getAllByAltText('Diya').some((i) => i.getAttribute('src') === 'c.jpg')).toBe(true),
    );
  });

  it('tolerates hover and mouse movement for the zoom effect', () => {
    const { container } = render(<ImageGallery images={['a.jpg']} alt="Diya" />);
    const zoomArea = container.querySelector('.cursor-zoom-in') as HTMLElement;
    fireEvent.mouseEnter(zoomArea);
    fireEvent.mouseMove(zoomArea, { clientX: 10, clientY: 10 });
    fireEvent.mouseLeave(zoomArea);
    expect(screen.getByAltText('Diya')).toBeInTheDocument();
  });

  it('requests 1200px for the main image and 200px lazy thumbnails', () => {
    const images = ['https://images.unsplash.com/photo-a', 'https://images.unsplash.com/photo-b'];
    render(<ImageGallery images={images} alt="Diya" />);
    expect(screen.getByRole('img', { name: 'Diya' }).getAttribute('src')).toContain('w=1200');
    const thumb = screen.getByRole('img', { name: 'Diya thumbnail 2' });
    expect(thumb.getAttribute('src')).toContain('w=200');
    expect(thumb).toHaveAttribute('loading', 'lazy');
  });
});
