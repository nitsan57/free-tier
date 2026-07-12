import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/photoslibrary.readonly",
  "https://www.googleapis.com/auth/photoslibrary.appendonly",
  "https://www.googleapis.com/auth/photoslibrary.edit",
  "openid",
  "email",
  "profile"
];

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
}

export class OAuthNotConfiguredError extends Error {
  constructor() {
    super(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI."
    );
    this.name = "OAuthNotConfiguredError";
  }
}

export function getOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new OAuthNotConfiguredError();
  }

  return { clientId, clientSecret, redirectUri };
}

export function createOAuthClient(config?: GoogleOAuthConfig): OAuth2Client {
  const cfg = config ?? getOAuthConfig();
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export function buildAuthUrl(client: OAuth2Client, state: string): string {
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: OAUTH_SCOPES,
    state
  });
}

export async function exchangeCodeForTokens(
  client: OAuth2Client,
  code: string
): Promise<GoogleTokens> {
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    expiryDate: tokens.expiry_date ?? Date.now() + 3600_000
  };
}

export interface GoogleUserInfo {
  id?: string;
  email?: string;
}

const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch user info (${res.status})`);
  }
  const data = (await res.json()) as { sub?: string; id?: string; email?: string };
  return { id: data.sub ?? data.id, email: data.email };
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const accessToken = (await client.getAccessToken()).token;
  if (!accessToken) {
    throw new Error("Failed to refresh Google access token");
  }
  const expiryDate = client.credentials.expiry_date ?? Date.now() + 3600_000;
  return { accessToken, refreshToken, expiryDate };
}
