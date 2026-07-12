import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: {} as Record<string, string>
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      const v = cookieStore[name];
      return v === undefined ? undefined : { name, value: v };
    },
    set: (name: string, value: string) => {
      cookieStore[name] = value;
    },
    delete: (name: string) => {
      delete cookieStore[name];
    }
  })
}) as unknown as Record<string, unknown>);

vi.mock("next/server", () => {
  class MockResponse {
    cookies = {
      set: (name: string, value: string) => {
        cookieStore[name] = value;
      }
    } as unknown as { set: (name: string, value: string, opts?: unknown) => void };
  }
  return { NextResponse: MockResponse };
});

import {
  encryptToken,
  decryptToken,
  generateOAuthState,
  validateOAuthState,
  setOAuthState,
  getOAuthState,
  clearOAuthState,
  setSession,
  getSession,
  clearSession,
  getValidAccessToken
} from "./index";
import { NextResponse } from "next/server";

beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_SECRET = "test-encryption-secret";
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  Object.keys(cookieStore).forEach((k) => delete cookieStore[k]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("encryptToken / decryptToken", () => {
  it("roundtrips a plaintext token", () => {
    const plaintext = "super-secret-refresh-token";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("uses a random IV so ciphertext differs each call", () => {
    const a = encryptToken("same");
    const b = encryptToken("same");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same");
    expect(decryptToken(b)).toBe("same");
  });

  it("throws when the ciphertext is tampered with", () => {
    const encrypted = encryptToken("secret");
    const buf = Buffer.from(encrypted, "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptToken(buf.toString("base64"))).toThrow();
  });
});

describe("CSRF OAuth state", () => {
  it("generates unique, non-empty state values", () => {
    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(a).toHaveLength(64);
    expect(b).toHaveLength(64);
    expect(a).not.toBe(b);
  });

  it("accepts a matching state", () => {
    const state = generateOAuthState();
    expect(validateOAuthState(state, state)).toBe(true);
  });

  it("rejects a mismatched state", () => {
    expect(validateOAuthState(generateOAuthState(), generateOAuthState())).toBe(
      false
    );
  });

  it("rejects when either side is missing", () => {
    expect(validateOAuthState(null, "expected")).toBe(false);
    expect(validateOAuthState("provided", null)).toBe(false);
  });

  it("persists and clears state via cookies", () => {
    const res = new NextResponse() as unknown as NextResponse;
    setOAuthState(res, "abc123");
    expect(getOAuthState()).toBe("abc123");
    clearOAuthState();
    expect(getOAuthState()).toBeNull();
  });
});

describe("getValidAccessToken", () => {
  it("returns the existing token when it is still valid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    setSession({
      googleAccessToken: "valid-access",
      expiresAt: Date.now() + 5 * 60_000
    });

    const token = await getValidAccessToken();
    expect(token).toBe("valid-access");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes an expired token using the refresh token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-access", expires_in: 3600 })
    });
    vi.stubGlobal("fetch", fetchMock);

    setSession({
      googleAccessToken: "old-access",
      googleRefreshToken: "refresh-123",
      expiresAt: Date.now() - 1000
    });

    const token = await getValidAccessToken();
    expect(token).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" })
    );

    const session = getSession();
    expect(session?.googleAccessToken).toBe("new-access");
    expect(session?.googleRefreshToken).toBe("refresh-123");
  });

  it("fails safe (returns null) when expired and no refresh token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    setSession({
      googleAccessToken: "expired-access",
      expiresAt: Date.now() - 1000
    });

    const token = await getValidAccessToken();
    expect(token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when there is no session", async () => {
    clearSession();
    expect(await getValidAccessToken()).toBeNull();
  });
});
