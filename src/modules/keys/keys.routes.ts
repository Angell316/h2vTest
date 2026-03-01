import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  uploadBundleHandler,
  fetchBundleHandler,
  hasBundleHandler,
  replenishHandler,
  preKeyCountHandler,
} from './keys.controller';

const router = Router();

router.use(authMiddleware as any);

router.post('/bundle', uploadBundleHandler as any);
router.get('/bundle/:userId', fetchBundleHandler as any);
router.get('/has-bundle/:userId', hasBundleHandler as any);  // lightweight, no OTP consumed
router.post('/replenish', replenishHandler as any);
router.get('/count', preKeyCountHandler as any);

export default router;
