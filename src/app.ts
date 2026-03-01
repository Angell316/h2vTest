import 'dotenv/config';
import http from 'http';
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

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// ─── Healthcheck ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api', messageRoutes);

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

    await redis.connect();

    httpServer.listen(PORT, () => {
      console.log(`[App] HTTP server running on http://localhost:${PORT}`);
      console.log(`[App] WebSocket server running on ws://localhost:${PORT}/ws`);
      console.log(`[App] Health: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('[App] Startup error:', err);
    process.exit(1);
  }
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
