import { NextRequest, NextResponse } from "next/server";
import {
  createOAuthClient,
  exchangeCodeForTokens,
  fetchUserInfo
} from "@/lib/google/oauth";
import {
  clearOAuthState,
  getOAuthState,
  setSession
} from "@/lib/session";

function redirectWithError(req: NextRequest, error: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/?auth_error=${encodeURIComponent(error)}`, req.url)
  );
}

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return redirectWithError(req, error);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = getOAuthState();
  clearOAuthState();

  if (!code) {
    return redirectWithError(req, "missing_code");
  }

  if (!state || !expectedState || state !== expectedState) {
    return redirectWithError(req, "invalid_state");
  }

  const client = createOAuthClient();

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(client, code);
  } catch {
    return redirectWithError(req, "token_exchange_failed");
  }

  if (!tokens.accessToken) {
    return redirectWithError(req, "no_access_token");
  }

  let user: { id?: string; email?: string } | undefined;
  try {
    user = await fetchUserInfo(tokens.accessToken);
  } catch {
    user = undefined;
  }

  setSession({
    googleAccessToken: tokens.accessToken,
    googleRefreshToken: tokens.refreshToken,
    expiresAt: tokens.expiryDate,
    user
  });

  return NextResponse.redirect(new URL("/clean", req.url));
}
