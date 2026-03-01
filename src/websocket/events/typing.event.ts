import { prisma } from '../../config/database';
import { presenceService } from '../../config/redis';
import { sendToUsers } from '../ws.server';

// ─── Пользователь начал печатать ─────────────────────────────────────────────
export async function handleTypingStart(
  userId: string,
  chatId: string,
): Promise<void> {
  await presenceService.setTyping(chatId, userId);

  const members = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true },
  });

  const memberIds = members.map((m) => m.userId);

  // Уведомить остальных участников (не себя)
  sendToUsers(memberIds, {
    event: 'typing:started',
    payload: { chatId, userId },
  }, userId);
}

// ─── Пользователь перестал печатать ──────────────────────────────────────────
export async function handleTypingStop(
  userId: string,
  chatId: string,
): Promise<void> {
  await presenceService.clearTyping(chatId, userId);

  const members = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true },
  });

  const memberIds = members.map((m) => m.userId);

  sendToUsers(memberIds, {
    event: 'typing:stopped',
    payload: { chatId, userId },
  }, userId);
}
