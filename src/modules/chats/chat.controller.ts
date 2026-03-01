import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../types';
import * as chatService from './chat.service';
import { ok, fail } from '../../utils/response';

export async function getMyChatsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const chats = await chatService.getUserChats(req.user!.sub);
    ok(res, chats);
  } catch (err) {
    next(err);
  }
}

export async function getChatHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const chat = await chatService.getChatById(String(req.params.id), req.user!.sub);
    ok(res, chat);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      fail(res, err.message, 404);
    } else {
      next(err);
    }
  }
}

export async function createDirectHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { targetUserId } = z
      .object({ targetUserId: z.string().min(1) })
      .parse(req.body);
    if (typeof targetUserId !== 'string') throw new Error('Invalid targetUserId');

    const chat = await chatService.createDirectChat(
      req.user!.sub,
      targetUserId,
    );
    ok(res, chat, 201);
  } catch (err) {
    next(err);
  }
}

export async function createGroupHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schema = z.object({
      name: z.string().min(1).max(64),
      memberIds: z.array(z.string()).min(1),
    });
    const { name, memberIds } = schema.parse(req.body);
    const chat = await chatService.createGroupChat(
      req.user!.sub,
      name,
      memberIds,
    );
    ok(res, chat, 201);
  } catch (err) {
    next(err);
  }
}

export async function leaveChatHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await chatService.leaveChat(String(req.params.id), req.user!.sub);
    ok(res, { message: 'Left chat' });
  } catch (err) {
    next(err);
  }
}
