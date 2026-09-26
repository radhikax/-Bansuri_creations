import { z } from 'zod';

export class EnvValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

const nonEmpty = z.string().min(1, 'is required');

const baseSchema = z.object({
  DATABASE_URL: nonEmpty,
  JWT_SECRET: nonEmpty,
});

const productionSchema = baseSchema.extend({
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters in production'),
  FRONTEND_ORIGIN: z.string().url('must be a URL'),
  RAZORPAY_KEY_ID: nonEmpty,
  RAZORPAY_KEY_SECRET: nonEmpty,
  RAZORPAY_WEBHOOK_SECRET: nonEmpty,
});

/**
 * Fails fast on a misconfigured deployment. Problems name the variable and the
 * rule, never the value, so secrets can't leak into logs.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const schema = env.NODE_ENV === 'production' ? productionSchema : baseSchema;
  const result = schema.safeParse(env);
  if (result.success) return;
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)';
    const rule = issue.code === 'invalid_type' ? 'is required' : issue.message;
    return `${name} ${rule}`;
  });
  throw new EnvValidationError(problems);
}
