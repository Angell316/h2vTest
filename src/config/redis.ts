import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
});

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));

// ─── Ключи ───────────────────────────────────────────────────────────────────
export const redisKeys = {
  userOnline: (userId: string) => `user:${userId}:online`,
  userLastOnline: (userId: string) => `user:${userId}:last_online`,
  userTyping: (chatId: string, userId: string) =>
    `chat:${chatId}:typing:${userId}`,
  chatTyping: (chatId: string) => `chat:${chatId}:typing`,
};

// ─── Онлайн-статус ───────────────────────────────────────────────────────────
export const presenceService = {
  async setOnline(userId: string): Promise<void> {
    await redis.set(redisKeys.userOnline(userId), '1', 'EX', 60);
  },

  async setOffline(userId: string): Promise<void> {
    const now = new Date().toISOString();
    await redis.del(redisKeys.userOnline(userId));
    await redis.set(redisKeys.userLastOnline(userId), now);
  },

  async isOnline(userId: string): Promise<boolean> {
    const val = await redis.get(redisKeys.userOnline(userId));
    return val === '1';
  },

  async getLastOnline(userId: string): Promise<string | null> {
    return redis.get(redisKeys.userLastOnline(userId));
  },

  async heartbeat(userId: string): Promise<void> {
    await redis.set(redisKeys.userOnline(userId), '1', 'EX', 60);
  },

  async setTyping(chatId: string, userId: string): Promise<void> {
    await redis.set(redisKeys.userTyping(chatId, userId), '1', 'EX', 5);
  },

  async clearTyping(chatId: string, userId: string): Promise<void> {
    await redis.del(redisKeys.userTyping(chatId, userId));
  },
};
