import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../types';
import * as userService from './user.service';
import { ok, fail } from '../../utils/response';

export async function getMeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await userService.getById(req.user!.sub);
    ok(res, user);
  } catch (err) {
    next(err);
  }
}

export async function getUserHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await userService.getById(String(req.params.id));
    ok(res, user);
  } catch (err) {
    if (err instanceof Error && err.message === 'User not found') {
      fail(res, err.message, 404);
    } else {
      next(err);
    }
  }
}

export async function searchUsersHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = z.string().min(1).parse(req.query.q);
    const users = await userService.search(q);
    ok(res, users);
  } catch (err) {
    next(err);
  }
}

export async function updateMeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schema = z.object({
      nickname: z.string().min(3).max(32).optional(),
      avatar: z.string().url().optional(),
      bio: z.string().max(256).optional(),
    });
    const data = schema.parse(req.body);
    const user = await userService.updateProfile(req.user!.sub, data);
    ok(res, user);
  } catch (err) {
    next(err);
  }
}

export async function deleteMeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await userService.deleteAccount(req.user!.sub);
    ok(res, { message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
}

export async function registerDeviceTokenHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schema = z.object({
      token: z.string().min(1),
      platform: z.enum(['IOS', 'ANDROID', 'WEB']),
    });
    const { token, platform } = schema.parse(req.body);
    const result = await userService.registerDeviceToken(req.user!.sub, token, platform);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function removeDeviceTokenHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    await userService.removeDeviceToken(token, req.user!.sub);
    ok(res, { message: 'Device token removed' });
  } catch (err) {
    next(err);
  }
}
