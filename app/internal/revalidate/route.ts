import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';

const ok = (a: string, b: string) =>
  a.length > 0 && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET ?? '';
  if (!ok(request.headers.get('x-revalidate-secret') ?? '', secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = body?.tags;
  if (!Array.isArray(tags) || tags.length === 0 || !tags.every((t) => typeof t === 'string' && t.length <= 128)) {
    return Response.json({ error: 'Body must be { tags: string[] }' }, { status: 400 });
  }
  // { expire: 0 }: the next visitor gets fresh data, never a stale page. 'max'
  // (stale-while-revalidate) would show the pre-edit page once more. This is
  // the documented choice for webhooks / other services calling a Route Handler.
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: tags });
}
