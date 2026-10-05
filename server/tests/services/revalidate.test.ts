import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { revalidate } from '../../src/services/revalidate';

describe('revalidate', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('is a no-op when WEB_INTERNAL_URL or REVALIDATE_SECRET is unset', () => {
    vi.stubEnv('WEB_INTERNAL_URL', '');
    vi.stubEnv('REVALIDATE_SECRET', 'x');
    revalidate(['catalogue']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the tags with the secret header', () => {
    vi.stubEnv('WEB_INTERNAL_URL', 'http://web:8080');
    vi.stubEnv('REVALIDATE_SECRET', 's3cret');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    revalidate(['catalogue', 'product:brass-diya']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://web:8080/internal/revalidate');
    expect(init.method).toBe('POST');
    expect(init.headers['x-revalidate-secret']).toBe('s3cret');
    expect(JSON.parse(init.body)).toEqual({ tags: ['catalogue', 'product:brass-diya'] });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('swallows network failures', async () => {
    vi.stubEnv('WEB_INTERNAL_URL', 'http://web:8080');
    vi.stubEnv('REVALIDATE_SECRET', 's3cret');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(() => revalidate(['catalogue'])).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
