import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET ?? "fallback-dev-secret-change-in-prod";
const JWT_EXPIRES_IN = "7d";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: string;
  username?: string;
  name?: string;
}

/** @deprecated Use AuthTokenPayload */
export type JwtPayload = AuthTokenPayload;

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

export function generateResetToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
