import { prisma } from '../../config/database';

const MESSAGE_SELECT = {
  id: true,
  chatId: true,
  text: true,
  ciphertext: true,
  signalType: true,
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
  reactions: {
    select: { id: true, userId: true, emoji: true },
  },
  replyTo: {
    select: {
      id: true,
      text: true,
      ciphertext: true,
      signalType: true,
      isDeleted: true,
      sender: { select: { id: true, nickname: true } },
    },
  },
};

// ─── Отправить сообщение ──────────────────────────────────────────────────────
export async function sendMessage(data: {
  chatId: string;
  senderId: string;
  text?: string;
  ciphertext?: string;
  signalType?: number;
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
      ciphertext: data.ciphertext,
      signalType: data.signalType ?? 0,
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
  query?: string,
) {
  const isMember = await prisma.chatMember.findFirst({
    where: { chatId, userId },
  });

  if (!isMember) throw new Error('Not a member of this chat');

  return prisma.message.findMany({
    where: {
      chatId,
      isDeleted: false,
      ...(query ? { text: { contains: query, mode: 'insensitive' } } : {}),
    },
    select: MESSAGE_SELECT,
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

// ─── Добавить реакцию ─────────────────────────────────────────────────────────
export async function addReaction(messageId: string, userId: string, emoji: string) {
  const ALLOWED = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
  if (!ALLOWED.includes(emoji)) throw new Error('Invalid emoji');

  const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { chatId: true } });
  if (!msg) throw new Error('Message not found');

  const isMember = await prisma.chatMember.findFirst({ where: { chatId: msg.chatId, userId } });
  if (!isMember) throw new Error('Not a member of this chat');

  const reaction = await prisma.reaction.upsert({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
    create: { messageId, userId, emoji },
    update: {},
    select: { id: true, messageId: true, userId: true, emoji: true },
  });

  return { reaction, chatId: msg.chatId };
}

// ─── Убрать реакцию ──────────────────────────────────────────────────────────
export async function removeReaction(messageId: string, userId: string, emoji: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { chatId: true } });
  if (!msg) throw new Error('Message not found');

  await prisma.reaction.deleteMany({ where: { messageId, userId, emoji } });
  return { chatId: msg.chatId };
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

  await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, text: null, ciphertext: null },
  });

  return { id: messageId, chatId: msg.chatId };
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
