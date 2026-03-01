import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { prisma } from './config/database';
import { redis } from './config/redis';
import { errorMiddleware } from './middleware/error.middleware';
import { createWsServer } from './websocket/ws.server';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import chatRoutes from './modules/chats/chat.routes';
import messageRoutes from './modules/messages/message.routes';
import keysRoutes from './modules/keys/keys.routes';
import uploadRoutes from './modules/upload/upload.routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Доверяем заголовкам прокси (Tuna / nginx)
app.set('trust proxy', 1);

// ─── Rate limiters ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20,                   // не более 20 попыток на auth за окно
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, try again later' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 300,            // 300 запросов в минуту на все остальные API
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, try again later' },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));

// ─── Uploads static ───────────────────────────────────────────────────────────
const uploadsPath = path.join(__dirname, '../../uploads');
app.use('/uploads', express.static(uploadsPath));

// ─── Frontend static ──────────────────────────────────────────────────────────
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// ─── Healthcheck ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/chats', apiLimiter, chatRoutes);
app.use('/api', apiLimiter, messageRoutes);
app.use('/api/keys', apiLimiter, keysRoutes);
app.use('/api/upload', apiLimiter, uploadRoutes);

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
