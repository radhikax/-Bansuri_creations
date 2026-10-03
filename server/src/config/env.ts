import { z } from 'zod';

export class EnvValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

const nonEmpty = z.string().min(1, 'is required');

// An empty string (e.g. an unset variable in a shared .env file) is treated the
// same as the variable being absent, rather than failing validation.
const optionalUrl = z.union([z.literal(''), z.string().url('must be a URL')]).optional();

const baseSchema = z.object({
  DATABASE_URL: nonEmpty,
  JWT_SECRET: nonEmpty,
  WEB_INTERNAL_URL: optionalUrl,
  REVALIDATE_SECRET: z.string().optional(),
});

const productionSchema = baseSchema.extend({
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters in production'),
  FRONTEND_ORIGIN: z.string().url('must be a URL'),
  RAZORPAY_KEY_ID: nonEmpty,
  RAZORPAY_KEY_SECRET: nonEmpty,
  RAZORPAY_WEBHOOK_SECRET: nonEmpty,
  // Optional (instant refresh can be off), but never guessable when set.
  REVALIDATE_SECRET: z
    .union([z.literal(''), z.string().min(32, 'must be at least 32 characters in production')])
    .optional(),
});

/**
 * Fails fast on a misconfigured deployment. Problems name the variable and the
 * rule, never the value, so secrets can't leak into logs.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const schema = env.NODE_ENV === 'production' ? productionSchema : baseSchema;
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const name = issue.path.join('.') || '(root)';
      const rule = issue.code === 'invalid_type' ? 'is required' : issue.message;
      return `${name} ${rule}`;
    });
    throw new EnvValidationError(problems);
  }

  if (env.NODE_ENV === 'production' && (!env.WEB_INTERNAL_URL || !env.REVALIDATE_SECRET)) {
    console.warn('REVALIDATE_SECRET/WEB_INTERNAL_URL not set: pages refresh on their 5-minute timer only');
  }
}
