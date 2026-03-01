import { prisma } from '../../config/database';

const MESSAGE_SELECT = {
  id: true,
  chatId: true,
  text: true,
  type: true,
  mediaUrl: true,
  replyToId: true,
  isEdited: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  sender: {
    select: { id: true, nickname: true, avatar: true },
  },
  readReceipts: {
    select: { userId: true, readAt: true },
  },
};

// ─── Отправить сообщение ──────────────────────────────────────────────────────
export async function sendMessage(data: {
  chatId: string;
  senderId: string;
  text?: string;
  type?: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO' | 'VIDEO';
  mediaUrl?: string;
  replyToId?: string;
}) {
  const isMember = await prisma.chatMember.findFirst({
    where: { chatId: data.chatId, userId: data.senderId },
  });

  if (!isMember) throw new Error('Not a member of this chat');

  const message = await prisma.message.create({
    data: {
      chatId: data.chatId,
      senderId: data.senderId,
      text: data.text,
      type: data.type ?? 'TEXT',
      mediaUrl: data.mediaUrl,
      replyToId: data.replyToId,
    },
    select: MESSAGE_SELECT,
  });

  // Обновить updatedAt чата
  await prisma.chat.update({
    where: { id: data.chatId },
    data: { updatedAt: new Date() },
  });

  return message;
}

// ─── Получить историю чата ────────────────────────────────────────────────────
export async function getChatMessages(
  chatId: string,
  userId: string,
  cursor?: string,
  limit = 50,
) {
  const isMember = await prisma.chatMember.findFirst({
    where: { chatId, userId },
  });

  if (!isMember) throw new Error('Not a member of this chat');

  return prisma.message.findMany({
    where: { chatId, isDeleted: false },
    select: MESSAGE_SELECT,
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
  });
}

// ─── Отметить как прочитанное ─────────────────────────────────────────────────
export async function markAsRead(messageId: string, userId: string) {
  return prisma.readReceipt.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId },
    update: { readAt: new Date() },
  });
}

// ─── Удалить сообщение (soft delete) ─────────────────────────────────────────
export async function deleteMessage(messageId: string, userId: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });

  if (!msg) throw new Error('Message not found');
  if (msg.senderId !== userId) throw new Error('Forbidden');

  return prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, text: null },
  });
}

// ─── Редактировать сообщение ──────────────────────────────────────────────────
export async function editMessage(
  messageId: string,
  userId: string,
  text: string,
) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });

  if (!msg) throw new Error('Message not found');
  if (msg.senderId !== userId) throw new Error('Forbidden');
  if (msg.isDeleted) throw new Error('Message is deleted');

  return prisma.message.update({
    where: { id: messageId },
    data: { text, isEdited: true },
    select: MESSAGE_SELECT,
  });
}
