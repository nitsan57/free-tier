import { cookies } from "next/headers";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "crypto";

const SESSION_COOKIE = "session";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface SessionData {
  googleAccessToken: string;
  googleRefreshToken?: string;
  expiresAt: number;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_SECRET is not set; cannot encrypt session tokens"
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(payload: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export function setSession(data: SessionData): void {
  const stored: SessionData = {
    ...data,
    googleRefreshToken: data.googleRefreshToken
      ? encryptToken(data.googleRefreshToken)
      : undefined
  };
  cookies().set(SESSION_COOKIE, JSON.stringify(stored), {
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
    const parsed = JSON.parse(raw) as SessionData;
    if (parsed.googleRefreshToken) {
      try {
        parsed.googleRefreshToken = decryptToken(parsed.googleRefreshToken);
      } catch {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const EXPIRY_BUFFER_MS = 60_000;

export interface GoogleTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

export async function refreshGoogleTokens(
  refreshToken: string
): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set; cannot refresh token"
    );
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };

  if (!data.access_token) {
    throw new Error("Google token refresh returned no access_token");
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    refreshToken: data.refresh_token ?? undefined
  };
}

export async function getValidAccessToken(
  forceRefresh = false
): Promise<string | null> {
  const session = getSession();
  if (!session) return null;

  const notExpired = session.expiresAt > Date.now() + EXPIRY_BUFFER_MS;
  if (!forceRefresh && notExpired) {
    return session.googleAccessToken;
  }

  if (!session.googleRefreshToken) {
    return session.googleAccessToken || null;
  }

  const refreshed = await refreshGoogleTokens(session.googleRefreshToken);
  setSession({
    googleAccessToken: refreshed.accessToken,
    googleRefreshToken: refreshed.refreshToken ?? session.googleRefreshToken,
    expiresAt: refreshed.expiresAt
  });

  return refreshed.accessToken;
}
