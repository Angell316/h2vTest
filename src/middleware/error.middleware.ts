import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation error',
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof Error) {
    console.error('[Error]', err.message);
    res.status(500).json({ success: false, message: err.message });
    return;
  }

  res.status(500).json({ success: false, message: 'Internal server error' });
}
