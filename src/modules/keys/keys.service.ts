import { prisma } from '../../config/database';

interface UploadBundleInput {
  userId: string;
  registrationId: number;
  identityKey: string;
  signedPreKeyId: number;
  signedPreKey: string;
  signedPreKeySig: string;
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
}

export async function uploadBundle(input: UploadBundleInput) {
  await prisma.preKeyBundle.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      registrationId: input.registrationId,
      identityKey: input.identityKey,
      signedPreKeyId: input.signedPreKeyId,
      signedPreKey: input.signedPreKey,
      signedPreKeySig: input.signedPreKeySig,
    },
    update: {
      registrationId: input.registrationId,
      identityKey: input.identityKey,
      signedPreKeyId: input.signedPreKeyId,
      signedPreKey: input.signedPreKey,
      signedPreKeySig: input.signedPreKeySig,
    },
  });

  if (input.oneTimePreKeys.length > 0) {
    await prisma.oneTimePreKey.createMany({
      data: input.oneTimePreKeys.map((k) => ({
        userId: input.userId,
        keyId: k.keyId,
        publicKey: k.publicKey,
      })),
    });
  }
}

export async function fetchBundle(targetUserId: string) {
  const bundle = await prisma.preKeyBundle.findUnique({
    where: { userId: targetUserId },
  });

  if (!bundle) return null;

  // Grab one OTP key and atomically delete it
  const otpKey = await prisma.oneTimePreKey.findFirst({
    where: { userId: targetUserId },
    orderBy: { keyId: 'asc' },
  });

  if (otpKey) {
    await prisma.oneTimePreKey.delete({ where: { id: otpKey.id } });
  }

  return {
    registrationId: bundle.registrationId,
    identityKey: bundle.identityKey,
    signedPreKeyId: bundle.signedPreKeyId,
    signedPreKey: bundle.signedPreKey,
    signedPreKeySig: bundle.signedPreKeySig,
    preKey: otpKey ? { keyId: otpKey.keyId, publicKey: otpKey.publicKey } : null,
  };
}

export async function replenishPreKeys(
  userId: string,
  keys: Array<{ keyId: number; publicKey: string }>,
) {
  await prisma.oneTimePreKey.createMany({
    data: keys.map((k) => ({
      userId,
      keyId: k.keyId,
      publicKey: k.publicKey,
    })),
  });
}

export async function getPreKeyCount(userId: string): Promise<number> {
  return prisma.oneTimePreKey.count({ where: { userId } });
}
