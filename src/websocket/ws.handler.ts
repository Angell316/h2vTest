import { WebSocket } from 'ws';
import { WsIncomingEvent } from '../types';
import { handleMessageSend, handleMessageRead } from './events/message.event';
import { handleTypingStart, handleTypingStop } from './events/typing.event';
import { presenceService } from '../config/redis';
import { sendToSocket } from './ws.server';

export async function handleWsEvent(
  ws: WebSocket,
  userId: string,
  data: unknown,
): Promise<void> {
  const event = data as WsIncomingEvent;

  if (!event?.event) {
    sendToSocket(ws, { event: 'error', payload: { message: 'Missing event field' } });
    return;
  }

  switch (event.event) {
    case 'message:send':
      await handleMessageSend(ws, userId, event.payload);
      break;

    case 'message:read':
      await handleMessageRead(ws, userId, event.payload);
      break;

    case 'typing:start':
      await handleTypingStart(userId, event.payload.chatId);
      break;

    case 'typing:stop':
      await handleTypingStop(userId, event.payload.chatId);
      break;

    case 'presence:ping':
      await presenceService.heartbeat(userId);
      break;

    default:
      sendToSocket(ws, {
        event: 'error',
        payload: { message: `Unknown event: ${(event as WsIncomingEvent).event}` },
      });
  }
}
