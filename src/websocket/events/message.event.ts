import { WebSocket } from 'ws';
import { sendMessage, markAsRead } from '../../modules/messages/message.service';
import { prisma } from '../../config/database';
import { sendToSocket, sendToUsers } from '../ws.server';
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
      type: payload.type ?? 'TEXT',
      mediaUrl: payload.mediaUrl,
      replyToId: payload.replyToId,
    });

    // Получить всех участников чата для рассылки
    const members = await prisma.chatMember.findMany({
      where: { chatId: payload.chatId },
      select: { userId: true },
    });

    const memberIds = members.map((m) => m.userId);

    // Разослать всем участникам (включая отправителя — для синхронизации вкладок)
    sendToUsers(memberIds, { event: 'message:new', payload: message });
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

    // Получить отправителя сообщения для уведомления
    const msg = await prisma.message.findUnique({
      where: { id: payload.messageId },
      select: { senderId: true, chatId: true },
    });

    if (msg) {
      sendToUsers([msg.senderId], {
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
