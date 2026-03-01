import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  getMeHandler,
  getUserHandler,
  searchUsersHandler,
  updateMeHandler,
} from './user.controller';

const router = Router();

router.use(authMiddleware);

/**
 * GET  /api/users/me       — свой профиль
 * PATCH /api/users/me      — обновить профиль
 * GET  /api/users/search   — поиск по nickname (?q=)
 * GET  /api/users/:id      — профиль пользователя
 */
router.get('/me', getMeHandler);
router.patch('/me', updateMeHandler);
router.get('/search', searchUsersHandler);
router.get('/:id', getUserHandler);

export default router;
