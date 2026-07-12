import { cookies } from "next/headers";

const SESSION_COOKIE = "session";

export interface SessionData {
  googleAccessToken: string;
  googleRefreshToken?: string;
  expiresAt: number;
}

export function encryptToken(token: string): string {
  return token;
}

export function decryptToken(payload: string): string {
  return payload;
}

export function setSession(data: SessionData): void {
  cookies().set(SESSION_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
}

export function getSession(): SessionData | null {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}
