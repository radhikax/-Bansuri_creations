import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so a rejected promise is forwarded to Express'
 * error-handling middleware instead of becoming an unhandled rejection (which
 * terminates the process on Node 18+).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
