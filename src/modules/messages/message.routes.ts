import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  getMessagesHandler,
  deleteMessageHandler,
  editMessageHandler,
} from './message.controller';

const router = Router();

router.use(authMiddleware);

/**
 * GET    /api/chats/:chatId/messages   — история сообщений (cursor pagination)
 * DELETE /api/messages/:id             — удалить своё сообщение
 * PATCH  /api/messages/:id             — редактировать сообщение
 */
router.get('/chats/:chatId/messages', getMessagesHandler);
router.delete('/messages/:id', deleteMessageHandler);
router.patch('/messages/:id', editMessageHandler);

export default router;
