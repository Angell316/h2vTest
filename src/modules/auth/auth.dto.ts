import { z } from 'zod';

export const RegisterDto = z.object({
  nickname: z
    .string()
    .min(3, 'Nickname min 3 chars')
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, digits and underscores'),
  email: z.string().email(),
  password: z.string().min(8, 'Password min 8 chars'),
});

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshDto = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterDto>;
export type LoginInput = z.infer<typeof LoginDto>;
export type RefreshInput = z.infer<typeof RefreshDto>;
