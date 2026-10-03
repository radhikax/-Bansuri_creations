import { describe, expect, it } from 'vitest';
import { metadata } from './layout';

describe('app/admin/layout metadata', () => {
  it('is noindex, nofollow so search engines never crawl the admin panel', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('sets a plain Admin title', () => {
    expect(metadata.title).toBe('Admin');
  });
});
