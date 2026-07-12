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
