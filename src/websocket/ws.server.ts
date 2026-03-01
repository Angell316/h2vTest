import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { verifyAccessToken } from '../utils/jwt';
import { presenceService } from '../config/redis';
import { handleWsEvent } from './ws.handler';
import { WsServerEvent } from '../types';

// ─── Карта: userId → Set<WebSocket> (несколько вкладок одного юзера) ─────────
export const userSockets = new Map<string, Set<WebSocket>>();

// ─── Карта: WebSocket → userId ────────────────────────────────────────────────
export const socketUser = new Map<WebSocket, string>();

export function createWsServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    // ── Авторизация через query-параметр token ──────────────────────────────
    const url = new URL(req.url ?? '', 'ws://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    let userId: string;
    let nickname: string;

    try {
      const payload = verifyAccessToken(token);
      userId = payload.sub;
      nickname = payload.nickname;
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    // ── Регистрация соединения ──────────────────────────────────────────────
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(ws);
    socketUser.set(ws, userId);

    // ── Онлайн-статус ───────────────────────────────────────────────────────
    await presenceService.setOnline(userId);
    broadcastPresence(userId, 'user:online');

    console.log(`[WS] Connected: ${nickname} (${userId})`);

    // ── Heartbeat — продлевает TTL в Redis каждые 30 сек ───────────────────
    const heartbeatInterval = setInterval(async () => {
      if (ws.readyState === WebSocket.OPEN) {
        await presenceService.heartbeat(userId);
      }
    }, 30_000);

    // ── Входящие сообщения ──────────────────────────────────────────────────
    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        await handleWsEvent(ws, userId, data);
      } catch (err) {
        sendToSocket(ws, { event: 'error', payload: { message: 'Bad JSON' } });
      }
    });

    // ── Отключение ──────────────────────────────────────────────────────────
    ws.on('close', async () => {
      clearInterval(heartbeatInterval);

      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          await presenceService.setOffline(userId);
          broadcastPresence(userId, 'user:offline');
        }
      }
      socketUser.delete(ws);

      console.log(`[WS] Disconnected: ${nickname} (${userId})`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for ${nickname}:`, err.message);
    });
  });

  return wss;
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

/** Отправить событие конкретному сокету */
export function sendToSocket<T>(ws: WebSocket, event: WsServerEvent<T>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

/** Отправить событие всем сокетам пользователя */
export function sendToUser<T>(userId: string, event: WsServerEvent<T>): void {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/** Отправить событие списку пользователей (участники чата) */
export function sendToUsers<T>(
  userIds: string[],
  event: WsServerEvent<T>,
  excludeUserId?: string,
): void {
  const payload = JSON.stringify(event);
  for (const uid of userIds) {
    if (uid === excludeUserId) continue;
    const sockets = userSockets.get(uid);
    if (!sockets) continue;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

/** Оповестить всех подключённых о смене онлайн-статуса */
function broadcastPresence(
  userId: string,
  eventType: 'user:online' | 'user:offline',
): void {
  const event = JSON.stringify({ event: eventType, payload: { userId } });
  for (const [, sockets] of userSockets) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(event);
      }
    }
  }
}
