import { WebSocket } from 'ws';
import { sendMessage, markAsRead } from '../../modules/messages/message.service';
import { prisma } from '../../config/database';
import { sendToSocket, sendToUsers, isUserOnline, sendToUser } from '../ws.server';
import { WsMessageSendEvent, WsMessageReadEvent } from '../../types';

// ─── Отправка сообщения через WS ─────────────────────────────────────────────
export async function handleMessageSend(
  ws: WebSocket,
  userId: string,
  payload: WsMessageSendEvent['payload'],
): Promise<void> {
  try {
    const message = await sendMessage({
      chatId: payload.chatId,
      senderId: userId,
      text: payload.text,
      ciphertext: payload.ciphertext,
      signalType: payload.signalType ?? 0,
      type: payload.type ?? 'TEXT',
      mediaUrl: payload.mediaUrl,
      replyToId: payload.replyToId,
    });

    const members = await prisma.chatMember.findMany({
      where: { chatId: payload.chatId },
      select: { userId: true },
    });

    const memberIds = members.map((m) => m.userId);

    // Разослать message:new всем участникам
    sendToUsers(memberIds, { event: 'message:new', payload: message });

    // Проверить кто из получателей онлайн → отправить delivered отправителю
    const onlineRecipients = memberIds.filter(
      (id) => id !== userId && isUserOnline(id),
    );

    if (onlineRecipients.length > 0) {
      sendToUser(userId, {
        event: 'message:delivered',
        payload: {
          messageId: message.id,
          chatId: payload.chatId,
        },
      });
    }
  } catch (err) {
    sendToSocket(ws, {
      event: 'error',
      payload: {
        message: err instanceof Error ? err.message : 'Failed to send message',
      },
    });
  }
}

// ─── Прочитать сообщение ──────────────────────────────────────────────────────
export async function handleMessageRead(
  ws: WebSocket,
  userId: string,
  payload: WsMessageReadEvent['payload'],
): Promise<void> {
  try {
    await markAsRead(payload.messageId, userId);

    const msg = await prisma.message.findUnique({
      where: { id: payload.messageId },
      select: { senderId: true, chatId: true },
    });

    if (msg) {
      // Уведомить отправителя: его сообщение прочитали
      sendToUser(msg.senderId, {
        event: 'message:read',
        payload: {
          messageId: payload.messageId,
          chatId: msg.chatId,
          readBy: userId,
        },
      });
    }
  } catch (err) {
    sendToSocket(ws, {
      event: 'error',
      payload: { message: 'Failed to mark as read' },
    });
  }
}
