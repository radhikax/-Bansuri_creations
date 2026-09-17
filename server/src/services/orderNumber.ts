export function generateOrderNumber(now: Date = new Date()): string {
  const timestampPart = now.getTime().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${timestampPart}${randomPart}`;
}
