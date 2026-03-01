import { Request } from 'express';
import { User } from '@prisma/client';

// ─── Расширение Express Request ───────────────────────────────────────────────
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ─── JWT ──────────────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;    // user id
  nickname: string;
  iat?: number;
  exp?: number;
}

// ─── WebSocket events (клиент → сервер) ──────────────────────────────────────
export type WsEventType =
  | 'message:send'
  | 'message:read'
  | 'message:delete'
  | 'typing:start'
  | 'typing:stop'
  | 'presence:ping';

export interface WsBaseEvent {
  event: WsEventType;
}

export interface WsMessageSendEvent extends WsBaseEvent {
  event: 'message:send';
  payload: {
    chatId: string;
    text?: string;
    type?: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO' | 'VIDEO';
    mediaUrl?: string;
    replyToId?: string;
  };
}

export interface WsMessageReadEvent extends WsBaseEvent {
  event: 'message:read';
  payload: { messageId: string; chatId: string };
}

export interface WsTypingEvent extends WsBaseEvent {
  event: 'typing:start' | 'typing:stop';
  payload: { chatId: string };
}

export interface WsPresencePingEvent extends WsBaseEvent {
  event: 'presence:ping';
}

export type WsIncomingEvent =
  | WsMessageSendEvent
  | WsMessageReadEvent
  | WsTypingEvent
  | WsPresencePingEvent;

// ─── WebSocket events (сервер → клиент) ──────────────────────────────────────
export type WsServerEventType =
  | 'message:new'
  | 'message:read'
  | 'message:deleted'
  | 'typing:started'
  | 'typing:stopped'
  | 'user:online'
  | 'user:offline'
  | 'error';

export interface WsServerEvent<T = unknown> {
  event: WsServerEventType;
  payload: T;
}

// ─── DTO shapes ──────────────────────────────────────────────────────────────
export type PublicUser = Pick<
  User,
  'id' | 'nickname' | 'avatar' | 'bio' | 'lastOnline' | 'isOnline'
>;
