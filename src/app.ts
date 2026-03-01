import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { prisma } from './config/database';
import { redis } from './config/redis';
import { errorMiddleware } from './middleware/error.middleware';
import { createWsServer } from './websocket/ws.server';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import chatRoutes from './modules/chats/chat.routes';
import messageRoutes from './modules/messages/message.routes';
import keysRoutes from './modules/keys/keys.routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// ─── Frontend static ──────────────────────────────────────────────────────────
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// ─── Healthcheck ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api', messageRoutes);
app.use('/api/keys', keysRoutes);

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorMiddleware);

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────
const httpServer = http.createServer(app);
createWsServer(httpServer);

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('[DB] PostgreSQL connected');
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err);
    process.exit(1);
  }

  // Redis — опциональный, не блокирует старт
  redis.connect().catch(() => {
    console.warn('[Redis] Not available — presence features disabled');
  });

  httpServer.listen(PORT, () => {
    console.log(`[App] HTTP  → http://localhost:${PORT}`);
    console.log(`[App] WS   → ws://localhost:${PORT}/ws`);
    console.log(`[App] Health → http://localhost:${PORT}/health`);
  });
}

start();

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('[App] Shutting down...');
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});
