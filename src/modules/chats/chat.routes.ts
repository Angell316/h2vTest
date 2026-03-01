import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  getMyChatsHandler,
  getChatHandler,
  createDirectHandler,
  createGroupHandler,
  leaveChatHandler,
} from './chat.controller';

const router = Router();

router.use(authMiddleware);

/**
 * GET    /api/chats              — список чатов текущего пользователя
 * GET    /api/chats/:id          — конкретный чат
 * POST   /api/chats/direct       — создать личный чат
 * POST   /api/chats/group        — создать групповой чат
 * DELETE /api/chats/:id/leave    — покинуть чат
 */
router.get('/', getMyChatsHandler);
router.get('/:id', getChatHandler);
router.post('/direct', createDirectHandler);
router.post('/group', createGroupHandler);
router.delete('/:id/leave', leaveChatHandler);

export default router;
