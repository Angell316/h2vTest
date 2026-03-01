import { prisma } from '../../config/database';
import { presenceService } from '../../config/redis';
import { sendToUsers } from '../ws.server';

// ─── Пользователь начал печатать ─────────────────────────────────────────────
export async function handleTypingStart(
  userId: string,
  chatId: string,
): Promise<void> {
  const members = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true },
  });

  const memberIds = members.map((m) => m.userId);

  // Проверка членства — игнорируем событие если юзер не в чате
  if (!memberIds.includes(userId)) return;

  await presenceService.setTyping(chatId, userId);

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
  const members = await prisma.chatMember.findMany({
    where: { chatId },
    select: { userId: true },
  });

  const memberIds = members.map((m) => m.userId);

  // Проверка членства — игнорируем событие если юзер не в чате
  if (!memberIds.includes(userId)) return;

  await presenceService.clearTyping(chatId, userId);

  sendToUsers(memberIds, {
    event: 'typing:stopped',
    payload: { chatId, userId },
  }, userId);
}
