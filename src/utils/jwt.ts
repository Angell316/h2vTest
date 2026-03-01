import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !REFRESH_SECRET) {
  console.error('[Fatal] JWT_SECRET and JWT_REFRESH_SECRET must be set in .env');
  process.exit(1);
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET!, { expiresIn: REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET!) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET!) as JwtPayload;
}
