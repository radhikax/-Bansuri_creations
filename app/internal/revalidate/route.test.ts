import { describe, it, expect, vi, beforeEach } from 'vitest';
const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: (t: string, p?: string) => revalidateTag(t, p) }));
import { POST } from './route';

const req = (body: unknown, secret?: string) =>
  new Request('http://web/internal/revalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-revalidate-secret': secret } : {}) },
    body: JSON.stringify(body),
  });

describe('POST /internal/revalidate', () => {
  beforeEach(() => { revalidateTag.mockReset(); vi.stubEnv('REVALIDATE_SECRET', 's3cret'); });

  it('rejects a missing or wrong secret', async () => {
    expect((await POST(req({ tags: ['catalogue'] }))).status).toBe(401);
    expect((await POST(req({ tags: ['catalogue'] }, 'nope'))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects when the server has no secret configured', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');
    expect((await POST(req({ tags: ['catalogue'] }, '')))).toHaveProperty('status', 401);
  });

  it('rejects a bad body', async () => {
    expect((await POST(req({ tags: 'catalogue' }, 's3cret'))).status).toBe(400);
  });

  it('revalidates each tag', async () => {
    const res = await POST(req({ tags: ['catalogue', 'product:brass-diya'] }, 's3cret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revalidated: ['catalogue', 'product:brass-diya'] });
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });
});
