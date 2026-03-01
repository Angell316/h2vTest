import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  getMessagesHandler,
  deleteMessageHandler,
  editMessageHandler,
  addReactionHandler,
  removeReactionHandler,
} from './message.controller';

const router = Router();

router.use(authMiddleware);

/**
 * GET    /api/chats/:chatId/messages        — история (cursor pagination, ?q=поиск)
 * DELETE /api/messages/:id                  — удалить сообщение
 * PATCH  /api/messages/:id                  — редактировать
 * POST   /api/messages/:id/reactions        — добавить реакцию { emoji }
 * DELETE /api/messages/:id/reactions/:emoji — убрать реакцию
 */
router.get('/chats/:chatId/messages', getMessagesHandler);
router.delete('/messages/:id', deleteMessageHandler);
router.patch('/messages/:id', editMessageHandler);
router.post('/messages/:id/reactions', addReactionHandler);
router.delete('/messages/:id/reactions/:emoji', removeReactionHandler);

export default router;
