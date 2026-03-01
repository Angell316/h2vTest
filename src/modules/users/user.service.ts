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
