import { prisma } from '../../config/database';

const MEMBER_INCLUDE = {
  user: {
    select: { id: true, nickname: true, avatar: true, isOnline: true },
  },
};

// ─── Создать личный чат (DIRECT) ─────────────────────────────────────────────
export async function createDirectChat(
  initiatorId: string,
  targetUserId: string,
) {
  if (initiatorId === targetUserId) throw new Error('Cannot create chat with yourself');
  // Проверить существующий direct-чат между двумя пользователями
  const existing = await prisma.chat.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { members: { some: { userId: initiatorId } } },
        { members: { some: { userId: targetUserId } } },
      ],
    },
    include: { members: { include: MEMBER_INCLUDE } },
  });

  if (existing) return existing;

  return prisma.chat.create({
    data: {
      type: 'DIRECT',
      members: {
        create: [
          { userId: initiatorId, role: 'OWNER' },
          { userId: targetUserId, role: 'MEMBER' },
        ],
      },
    },
    include: { members: { include: MEMBER_INCLUDE } },
  });
}

// ─── Создать групповой чат ────────────────────────────────────────────────────
export async function createGroupChat(
  ownerId: string,
  name: string,
  memberIds: string[],
) {
  const uniqueMembers = [...new Set([ownerId, ...memberIds])];

  return prisma.chat.create({
    data: {
      type: 'GROUP',
      name,
      members: {
        create: uniqueMembers.map((uid) => ({
          userId: uid,
          role: uid === ownerId ? 'OWNER' : 'MEMBER',
        })),
      },
    },
    include: { members: { include: MEMBER_INCLUDE } },
  });
}

// ─── Список чатов пользователя (cursor pagination) ───────────────────────────
export async function getUserChats(
  userId: string,
  cursor?: string,
  limit = 30,
) {
  const chats = await prisma.chat.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: MEMBER_INCLUDE },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          text: true,
          ciphertext: true,
          signalType: true,
          type: true,
          createdAt: true,
          sender: { select: { id: true, nickname: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const nextCursor = chats.length === limit ? chats[chats.length - 1].id : null;
  return { chats, nextCursor };
}

// ─── Получить чат по ID (с проверкой членства) ───────────────────────────────
export async function getChatById(chatId: string, userId: string) {
  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      members: { some: { userId } },
    },
    include: { members: { include: MEMBER_INCLUDE } },
  });

  if (!chat) throw new Error('Chat not found or access denied');
  return chat;
}

// ─── Добавить участника ───────────────────────────────────────────────────────
export async function addMember(chatId: string, userId: string) {
  return prisma.chatMember.create({
    data: { chatId, userId },
  });
}

// ─── Покинуть чат ─────────────────────────────────────────────────────────────
export async function leaveChat(chatId: string, userId: string) {
  return prisma.chatMember.deleteMany({
    where: { chatId, userId },
  });
}
