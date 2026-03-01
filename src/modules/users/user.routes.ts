import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  getMeHandler,
  getUserHandler,
  searchUsersHandler,
  updateMeHandler,
  deleteMeHandler,
  registerDeviceTokenHandler,
  removeDeviceTokenHandler,
} from './user.controller';

const router = Router();

router.use(authMiddleware);

/**
 * GET    /api/users/me                — свой профиль
 * PATCH  /api/users/me                — обновить профиль
 * DELETE /api/users/me                — удалить аккаунт (обязательно для App Store)
 * POST   /api/users/me/device-token   — зарегистрировать push-токен (FCM/APNs)
 * DELETE /api/users/me/device-token   — удалить push-токен (logout на устройстве)
 * GET    /api/users/search            — поиск по nickname (?q=)
 * GET    /api/users/:id               — профиль пользователя
 */
router.get('/me', getMeHandler);
router.patch('/me', updateMeHandler);
router.delete('/me', deleteMeHandler);
router.post('/me/device-token', registerDeviceTokenHandler);
router.delete('/me/device-token', removeDeviceTokenHandler);
router.get('/search', searchUsersHandler);
router.get('/:id', getUserHandler);

export default router;
