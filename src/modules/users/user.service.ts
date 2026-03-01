import { prisma } from '../../config/database';
import { presenceService } from '../../config/redis';

const PUBLIC_SELECT = {
  id: true,
  nickname: true,
  avatar: true,
  bio: true,
  lastOnline: true,
  isOnline: true,
};

// ─── Получить профиль по ID ──────────────────────────────────────────────────
export async function getById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_SELECT,
  });

  if (!user) throw new Error('User not found');

  const online = await presenceService.isOnline(userId);
  const lastOnlineRedis = online
    ? null
    : await presenceService.getLastOnline(userId);

  return {
    ...user,
    isOnline: online,
    lastOnline: lastOnlineRedis ? new Date(lastOnlineRedis) : user.lastOnline,
  };
}

// ─── Поиск пользователей по nickname ─────────────────────────────────────────
export async function search(query: string, limit = 20) {
  return prisma.user.findMany({
    where: {
      nickname: { contains: query, mode: 'insensitive' },
    },
    select: PUBLIC_SELECT,
    take: limit,
  });
}

// ─── Обновить профиль ────────────────────────────────────────────────────────
export async function updateProfile(
  userId: string,
  data: { nickname?: string; avatar?: string; bio?: string },
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: PUBLIC_SELECT,
  });
}

// ─── Удалить аккаунт (все данные через cascade) ───────────────────────────────
export async function deleteAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}

// ─── Зарегистрировать токен устройства для push-уведомлений ──────────────────
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'IOS' | 'ANDROID' | 'WEB',
) {
  return prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform },
    select: { id: true, token: true, platform: true, createdAt: true },
  });
}

// ─── Удалить токен устройства (при logout на конкретном устройстве) ───────────
export async function removeDeviceToken(token: string, userId: string) {
  await prisma.deviceToken.deleteMany({ where: { token, userId } });
}
