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

  const translations: Record<string, string> = {
    'Nickname min 3 chars':  'Никнейм минимум 3 символа',
    'Only letters, digits and underscores': 'Никнейм: только латиница, цифры и _',
    'Password min 8 chars':  'Пароль минимум 8 символов',
    'Invalid email':         'Неверный формат email',
  };

  return translations[msg] ?? `${field}: ${msg}`;
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
      const ru = err.message.includes('Email')
        ? 'Этот email уже занят'
        : 'Этот никнейм уже занят';
      fail(res, ru, 409);
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
      fail(res, 'Неверный email или пароль', 401);
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
