import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';

// jsdom lacks these browser APIs used by motion, Radix and the reveal components.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
vi.stubGlobal('ResizeObserver', MockResizeObserver);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom has no Web Animations API (used by flyToCart).
if (!window.HTMLElement.prototype.animate) {
  window.HTMLElement.prototype.animate = (() => ({
    onfinish: null,
    oncancel: null,
    cancel() {},
    finish() {},
  })) as unknown as typeof window.HTMLElement.prototype.animate;
}

window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.releasePointerCapture = () => {};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

// React 18 drops refs passed to plain function components. Radix (asChild, Slot,
// Presence) relies on them, so treat React's warning as a test failure.
const refWarnings: string[] = [];
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const message = args.map((a) => String(a)).join(' ');
  if (message.includes('cannot be given refs')) {
    refWarnings.push(message.slice(0, 300));
  }
  originalConsoleError(...args);
};
afterEach(() => {
  if (refWarnings.length > 0) {
    const found = refWarnings.splice(0);
    throw new Error(`React ref warning(s) — a component needs React.forwardRef:\n${found.join('\n')}`);
  }
});
