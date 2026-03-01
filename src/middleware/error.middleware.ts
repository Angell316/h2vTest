import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Коды ошибок Prisma, которые можно показать клиенту как 400/404
const PRISMA_CLIENT_CODES: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: 'Already exists' },
  P2025: { status: 404, message: 'Not found' },
  P2003: { status: 400, message: 'Invalid reference' },
};

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

  // Prisma-ошибки: логируем полностью, клиенту даём безопасное сообщение
  if (err instanceof Error && 'code' in err) {
    const prismaErr = err as Error & { code: string };
    console.error('[Prisma]', prismaErr.code, prismaErr.message);
    const mapped = PRISMA_CLIENT_CODES[prismaErr.code];
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
    } else {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
    return;
  }

  if (err instanceof Error) {
    // Прикладные ошибки (Not a member, Forbidden и т.п.) — показываем текст
    console.error('[Error]', err.message);
    res.status(500).json({ success: false, message: err.message });
    return;
  }

  res.status(500).json({ success: false, message: 'Internal server error' });
}
