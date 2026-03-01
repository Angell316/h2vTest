import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import type { RegisterInput, LoginInput } from './auth.dto';

const SALT_ROUNDS = 12;

// ─── Регистрация ─────────────────────────────────────────────────────────────
export async function register(input: RegisterInput) {
  const exists = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { nickname: input.nickname }],
    },
  });

  if (exists) {
    throw new Error(
      exists.email === input.email
        ? 'Email already in use'
        : 'Nickname already taken',
    );
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      nickname: input.nickname,
      email: input.email,
      passwordHash,
    },
    select: {
      id: true,
      nickname: true,
      email: true,
      avatar: true,
      createdAt: true,
    },
  });

  const tokens = await issueTokens(user.id, user.nickname);
  return { user, tokens };
}

// ─── Вход ────────────────────────────────────────────────────────────────────
export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');

  const tokens = await issueTokens(user.id, user.nickname);
  return {
    user: {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      avatar: user.avatar,
    },
    tokens,
  };
}

// ─── Обновление токенов ───────────────────────────────────────────────────────
export async function refresh(token: string) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new Error('Invalid refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw new Error('Refresh token expired or not found');
  }

  await prisma.refreshToken.delete({ where: { token } });

  const tokens = await issueTokens(payload.sub, payload.nickname);
  return tokens;
}

// ─── Выход ───────────────────────────────────────────────────────────────────
export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

// ─── Вспомогательное: выдача пары токенов ────────────────────────────────────
async function issueTokens(userId: string, nickname: string) {
  const accessToken = signAccessToken({ sub: userId, nickname });
  const refreshToken = signRefreshToken({ sub: userId, nickname });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt },
  });

  return { accessToken, refreshToken };
}
