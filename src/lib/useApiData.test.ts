import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApiData } from './useApiData';

describe('useApiData', () => {
  it('starts in the loading state', () => {
    const { result } = renderHook(() => useApiData(() => new Promise<string>(() => {})));
    expect(result.current).toEqual({ data: null, loading: true, error: null });
  });

  it('resolves to data on success', async () => {
    const { result } = renderHook(() => useApiData(() => Promise.resolve(['a', 'b'])));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({ data: ['a', 'b'], loading: false, error: null });
  });

  it('exposes the error message on failure', async () => {
    const { result } = renderHook(() => useApiData(() => Promise.reject(new Error('boom'))));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({ data: null, loading: false, error: 'boom' });
  });

  it('uses a generic message when a non-Error is thrown', async () => {
    const { result } = renderHook(() => useApiData(() => Promise.reject('nope')));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Unknown error');
  });

  it('ignores a result that arrives after unmount', async () => {
    let resolve!: (v: string) => void;
    const pending = new Promise<string>((r) => (resolve = r));
    const { result, unmount } = renderHook(() => useApiData(() => pending));
    unmount();
    resolve('late');
    await pending;
    // state must remain untouched (no update after unmount)
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('only calls the fetcher once across re-renders', async () => {
    let calls = 0;
    const fetcher = () => {
      calls += 1;
      return Promise.resolve('x');
    };
    const { result, rerender } = renderHook(() => useApiData(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender();
    expect(calls).toBe(1);
  });
});
