import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import * as authService from './auth.service';
import { RegisterDto, LoginDto, RefreshDto } from './auth.dto';
import { ok, fail } from '../../utils/response';

// Человекочитаемые сообщения для Zod-ошибок
function zodMessage(err: ZodError): string {
  const issues = err.errors;
  if (!issues.length) return 'Ошибка валидации';
  const first = issues[0];
  const field = first.path.join('.');
  const msg = first.message;

  // Возвращаем коды ошибок (фронтенд переводит в русский)
  const codes: Record<string, string> = {
    'Nickname min 3 chars':  'NICKNAME_TOO_SHORT',
    'Only letters, digits and underscores': 'NICKNAME_INVALID_CHARS',
    'Password min 8 chars':  'PASSWORD_TOO_SHORT',
    'Invalid email':         'EMAIL_INVALID',
    'String must contain at least 1 character(s)': 'FIELD_REQUIRED',
  };

  return codes[msg] ?? `VALIDATION_ERROR:${field}`;
}

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = RegisterDto.parse(req.body);
    const result = await authService.register(input);
    ok(res, result, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      fail(res, zodMessage(err), 422);
    } else if (err instanceof Error && err.message.includes('already')) {
      const code = err.message.includes('Email') ? 'EMAIL_TAKEN' : 'NICKNAME_TAKEN';
      fail(res, code, 409);
    } else {
      next(err);
    }
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = LoginDto.parse(req.body);
    const result = await authService.login(input);
    ok(res, result);
  } catch (err) {
    if (err instanceof ZodError) {
      fail(res, zodMessage(err), 422);
    } else if (err instanceof Error && err.message === 'Invalid credentials') {
      fail(res, 'INVALID_CREDENTIALS', 401);
    } else {
      next(err);
    }
  }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken } = RefreshDto.parse(req.body);
    const tokens = await authService.refresh(refreshToken);
    ok(res, tokens);
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken } = RefreshDto.parse(req.body);
    await authService.logout(refreshToken);
    ok(res, { message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}
