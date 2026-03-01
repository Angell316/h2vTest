import { Router } from 'express';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
} from './auth.controller';

const router = Router();

/**
 * POST /api/auth/register  — регистрация
 * POST /api/auth/login     — вход
 * POST /api/auth/refresh   — обновление access-токена
 * POST /api/auth/logout    — выход (инвалидация refresh-токена)
 */
router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);

export default router;
