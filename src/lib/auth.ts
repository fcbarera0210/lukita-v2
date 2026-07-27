import bcrypt from 'bcryptjs';
import { eq, and, gt } from 'drizzle-orm';
import type { AstroCookies } from 'astro';
import { getDb } from '../db';
import { sessions, users, type User } from '../db/schema';

const COOKIE_NAME = 'lukita_session';
const SESSION_DAYS = 30;

function requireSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET debe tener al menos 16 caracteres');
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(userId: string, cookies: AstroCookies): Promise<void> {
  requireSecret();
  const db = getDb();
  const token = randomToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await db.insert(sessions).values({ userId, token, expiresAt });

  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const db = getDb();
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch {
      // ignore if DB unavailable during logout
    }
  }
  cookies.delete(COOKIE_NAME, { path: '/' });
}

export async function getSessionUser(cookies: AstroCookies): Promise<User | null> {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .limit(1);

  return rows[0]?.user ?? null;
}

export async function registerUser(email: string, password: string) {
  const db = getDb();
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      email: email.trim().toLowerCase(),
      passwordHash,
      monthCutoffDay: 1,
      theme: 'dark',
      dashboardRecentCount: 5,
    })
    .returning();
  return user;
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}
