import { describe, it, expect, vi } from 'vitest';
import { validateEnv, EnvValidationError } from '../../src/config/env';

const devBase = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'dev-secret',
};

const prodBase = {
  ...devBase,
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(32),
  FRONTEND_ORIGIN: 'https://shop.example.com',
  RAZORPAY_KEY_ID: 'rzp_live_id',
  RAZORPAY_KEY_SECRET: 'super-secret-value',
  RAZORPAY_WEBHOOK_SECRET: 'whsec-value',
};

function problemsOf(env: Record<string, string>): string[] {
  try {
    validateEnv(env);
    return [];
  } catch (err) {
    expect(err).toBeInstanceOf(EnvValidationError);
    return (err as EnvValidationError).problems;
  }
}

describe('validateEnv', () => {
  it('accepts a minimal development environment', () => {
    expect(problemsOf(devBase)).toEqual([]);
  });

  it('names a missing DATABASE_URL', () => {
    const problems = problemsOf({ JWT_SECRET: 'dev-secret' });
    expect(problems.some((p) => p.startsWith('DATABASE_URL'))).toBe(true);
  });

  it('names an empty JWT_SECRET', () => {
    const problems = problemsOf({ ...devBase, JWT_SECRET: '' });
    expect(problems.some((p) => p.startsWith('JWT_SECRET'))).toBe(true);
  });

  it('accepts a complete production environment', () => {
    expect(problemsOf(prodBase)).toEqual([]);
  });

  it('rejects a production JWT_SECRET shorter than 32 characters', () => {
    const problems = problemsOf({ ...prodBase, JWT_SECRET: 'short' });
    expect(problems.some((p) => p.startsWith('JWT_SECRET'))).toBe(true);
  });

  it('requires the Razorpay keys and FRONTEND_ORIGIN in production', () => {
    const withoutSecret = { ...prodBase } as Record<string, string>;
    delete withoutSecret.RAZORPAY_KEY_SECRET;
    const problems = problemsOf({ ...withoutSecret, FRONTEND_ORIGIN: 'not a url' });
    expect(problems.some((p) => p.startsWith('RAZORPAY_KEY_SECRET'))).toBe(true);
    expect(problems.some((p) => p.startsWith('FRONTEND_ORIGIN'))).toBe(true);
  });

  it('warns in production when WEB_INTERNAL_URL/REVALIDATE_SECRET are not set', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateEnv(prodBase);
    expect(warnSpy).toHaveBeenCalledWith(
      'REVALIDATE_SECRET/WEB_INTERNAL_URL not set: pages refresh on their 5-minute timer only',
    );
    warnSpy.mockRestore();
  });

  it('does not warn in production when WEB_INTERNAL_URL and REVALIDATE_SECRET are set', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateEnv({ ...prodBase, WEB_INTERNAL_URL: 'http://web:8080', REVALIDATE_SECRET: 'r'.repeat(32) });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('rejects a production REVALIDATE_SECRET shorter than 32 characters', () => {
    const problems = problemsOf({ ...prodBase, REVALIDATE_SECRET: 'short' });
    expect(problems.some((p) => p.startsWith('REVALIDATE_SECRET'))).toBe(true);
  });

  it('accepts an empty production REVALIDATE_SECRET as unset', () => {
    expect(problemsOf({ ...prodBase, REVALIDATE_SECRET: '' })).toEqual([]);
  });

  it('accepts a short REVALIDATE_SECRET outside production', () => {
    expect(problemsOf({ ...devBase, REVALIDATE_SECRET: 'dev' })).toEqual([]);
  });

  it('accepts an empty-string WEB_INTERNAL_URL as unset, without failing validation', () => {
    expect(problemsOf({ ...devBase, WEB_INTERNAL_URL: '' })).toEqual([]);
  });

  it('rejects a non-empty WEB_INTERNAL_URL that is not a valid URL', () => {
    const problems = problemsOf({ ...devBase, WEB_INTERNAL_URL: 'not a url' });
    expect(problems.some((p) => p.startsWith('WEB_INTERNAL_URL'))).toBe(true);
  });

  it('never includes a variable value in its problems or message', () => {
    try {
      validateEnv({ ...prodBase, JWT_SECRET: 'leaky-secret' });
      throw new Error('expected validation to fail');
    } catch (err) {
      const e = err as EnvValidationError;
      expect(e.message).not.toContain('leaky-secret');
      expect(e.problems.join(' ')).not.toContain('leaky-secret');
    }
  });
});
