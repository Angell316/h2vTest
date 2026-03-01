import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { RegisterDto, LoginDto, RefreshDto } from './auth.dto';
import { ok, fail } from '../../utils/response';

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
    if (err instanceof Error && err.message.includes('already')) {
      fail(res, err.message, 409);
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
    if (err instanceof Error && err.message === 'Invalid credentials') {
      fail(res, err.message, 401);
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
