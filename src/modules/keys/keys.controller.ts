import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { ok, fail } from '../../utils/response';
import * as keysService from './keys.service';

export async function uploadBundleHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.sub;
    const {
      registrationId,
      identityKey,
      signedPreKeyId,
      signedPreKey,
      signedPreKeySig,
      oneTimePreKeys,
    } = req.body;

    if (
      !registrationId ||
      !identityKey ||
      signedPreKeyId == null ||
      !signedPreKey ||
      !signedPreKeySig
    ) {
      fail(res, 'MISSING_KEY_FIELDS', 400);
      return;
    }

    await keysService.uploadBundle({
      userId,
      registrationId,
      identityKey,
      signedPreKeyId,
      signedPreKey,
      signedPreKeySig,
      oneTimePreKeys: oneTimePreKeys ?? [],
    });

    ok(res, { uploaded: true }, 201);
  } catch (err) {
    next(err);
  }
}

export async function fetchBundleHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const targetUserId = String(req.params.userId);
    const bundle = await keysService.fetchBundle(targetUserId);

    if (!bundle) {
      fail(res, 'BUNDLE_NOT_FOUND', 404);
      return;
    }

    ok(res, bundle);
  } catch (err) {
    next(err);
  }
}

export async function replenishHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.sub;
    const { preKeys } = req.body;

    if (!Array.isArray(preKeys) || preKeys.length === 0) {
      fail(res, 'MISSING_PREKEYS', 400);
      return;
    }

    await keysService.replenishPreKeys(userId, preKeys);
    ok(res, { added: preKeys.length });
  } catch (err) {
    next(err);
  }
}

export async function hasBundleHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const targetUserId = String(req.params.userId);
    const has = await keysService.hasBundle(targetUserId);
    ok(res, { hasBundle: has });
  } catch (err) {
    next(err);
  }
}

export async function preKeyCountHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.sub;
    const count = await keysService.getPreKeyCount(userId);
    ok(res, { count });
  } catch (err) {
    next(err);
  }
}
