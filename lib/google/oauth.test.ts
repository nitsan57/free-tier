import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchUserInfo, OAUTH_SCOPES } from "./oauth";

afterEach(() => vi.unstubAllGlobals());

describe("OAUTH_SCOPES", () => {
  it("requests full library readonly access (not appcreateddata)", () => {
    expect(OAUTH_SCOPES).toContain(
      "https://www.googleapis.com/auth/photoslibrary.readonly"
    );
    expect(OAUTH_SCOPES).not.toContain(
      "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata"
    );
  });
});

describe("fetchUserInfo", () => {
  it("reads id and email from the OIDC userinfo endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sub: "user-123", email: "user@example.com" })
    });
    vi.stubGlobal("fetch", fetchMock);

    const info = await fetchUserInfo("token");
    expect(info).toEqual({ id: "user-123", email: "user@example.com" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: "Bearer token" } }
    );
  });

  it("handles a missing email gracefully", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sub: "user-123" })
    });
    vi.stubGlobal("fetch", fetchMock);

    const info = await fetchUserInfo("token");
    expect(info).toEqual({ id: "user-123", email: undefined });
  });

  it("throws when the userinfo endpoint returns an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchUserInfo("token")).rejects.toThrow();
  });
});
