import { describe, expect, it } from 'vitest';
import { imageSrcSet, optimizedImageUrl } from './images';

const RAW = 'https://images.unsplash.com/photo-123';

describe('optimizedImageUrl', () => {
  it('adds sizing params to a bare Unsplash URL', () => {
    const url = new URL(optimizedImageUrl(RAW, 600));
    expect(url.origin + url.pathname).toBe(RAW);
    expect(url.searchParams.get('w')).toBe('600');
    expect(url.searchParams.get('q')).toBe('75');
    expect(url.searchParams.get('auto')).toBe('format');
    expect(url.searchParams.get('fit')).toBe('crop');
  });

  it('overrides w and q but keeps other existing params', () => {
    const url = new URL(optimizedImageUrl(`${RAW}?w=1080&q=80&ixid=abc`, 200));
    expect(url.searchParams.get('w')).toBe('200');
    expect(url.searchParams.get('q')).toBe('75');
    expect(url.searchParams.get('ixid')).toBe('abc');
  });

  it.each([
    'https://img.test/diya.jpg',
    '/assets/logo.png',
    'data:image/png;base64,AAAA',
    '',
  ])('returns %j unchanged', (input) => {
    expect(optimizedImageUrl(input, 600)).toBe(input);
  });
});

describe('imageSrcSet', () => {
  it('gives 1x and 2x candidates for Unsplash URLs', () => {
    expect(imageSrcSet(RAW, 600)).toBe(`${optimizedImageUrl(RAW, 600)} 1x, ${optimizedImageUrl(RAW, 1200)} 2x`);
  });

  it('is undefined for other URLs', () => {
    expect(imageSrcSet('https://img.test/diya.jpg', 600)).toBeUndefined();
  });
});
