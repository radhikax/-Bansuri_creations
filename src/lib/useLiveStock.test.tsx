import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { API_URL, makeApiProduct, makeApiVariant } from '../test/fixtures';
import { useLiveStock } from './useLiveStock';

const initial = [{ id: 'v-1', label: 'Default', price: 500, stock: 5 }];

describe('useLiveStock', () => {
  it('returns the initial variants immediately', () => {
    const { result } = renderHook(() => useLiveStock('brass-diya', initial));
    expect(result.current).toEqual(initial);
  });

  it('updates the stock values from GET /api/products/:slug', async () => {
    server.use(
      http.get(`${API_URL}/api/products/:slug`, () =>
        HttpResponse.json(
          makeApiProduct({
            slug: 'brass-diya',
            basePrice: 500,
            variants: [makeApiVariant({ id: 'v-1', label: 'Default', price: null, stock: 2 })],
          }),
        ),
      ),
    );

    const { result } = renderHook(() => useLiveStock('brass-diya', initial));

    await waitFor(() =>
      expect(result.current).toEqual([{ id: 'v-1', label: 'Default', price: 500, stock: 2 }]),
    );
  });

  it('keeps the initial variants if the request fails', async () => {
    server.use(http.get(`${API_URL}/api/products/:slug`, () => HttpResponse.error()));

    const { result } = renderHook(() => useLiveStock('brass-diya', initial));

    // Give the rejected request a turn to (not) update state.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current).toEqual(initial);
  });
});
