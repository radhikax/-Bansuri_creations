/**
 * Asks the Next.js web app to rebuild cached pages for these tags. Fire-and-forget:
 * never throws, never delays the caller; pages still refresh on their 5-minute timer.
 */
export function revalidate(tags: string[]): void {
  const base = process.env.WEB_INTERNAL_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!base || !secret || tags.length === 0) return;
  fetch(`${base}/internal/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(3000),
  })
    .then((res) => {
      if (!res.ok) console.error(`revalidate ${tags.join(',')} → HTTP ${res.status}`);
    })
    .catch((err: unknown) => console.error('revalidate failed', err));
}
