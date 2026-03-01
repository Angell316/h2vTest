import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../types';
import * as messageService from './message.service';
import { ok, fail } from '../../utils/response';

export async function getMessagesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schema = z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(50),
    });
    const { cursor, limit } = schema.parse(req.query);
    const messages = await messageService.getChatMessages(
      String(req.params.chatId),
      req.user!.sub,
      cursor,
      limit,
    );
    ok(res, messages);
  } catch (err) {
    if (err instanceof Error && err.message.includes('member')) {
      fail(res, err.message, 403);
    } else {
      next(err);
    }
  }
}

export async function deleteMessageHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await messageService.deleteMessage(String(req.params.id), req.user!.sub);
    ok(res, { message: 'Deleted' });
  } catch (err) {
    if (err instanceof Error && err.message === 'Forbidden') {
      fail(res, err.message, 403);
    } else {
      next(err);
    }
  }
}

export async function editMessageHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { text } = z.object({ text: z.string().min(1) }).parse(req.body);
    const message = await messageService.editMessage(
      String(req.params.id),
      req.user!.sub,
      text,
    );
    ok(res, message);
  } catch (err) {
    if (err instanceof Error && err.message === 'Forbidden') {
      fail(res, err.message, 403);
    } else {
      next(err);
    }
  }
}
