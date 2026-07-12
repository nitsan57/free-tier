import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/session";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error)}`, req.url)
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/?auth_error=missing_code", req.url)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL("/?auth_error=oauth_not_configured", req.url)
    );
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/?auth_error=token_exchange_failed", req.url)
    );
  }

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokens.access_token) {
    return NextResponse.redirect(
      new URL("/?auth_error=no_access_token", req.url)
    );
  }

  setSession({
    googleAccessToken: tokens.access_token,
    googleRefreshToken: tokens.refresh_token,
    expiresAt:
      Date.now() + (tokens.expires_in ?? 3600) * 1000
  });

  return NextResponse.redirect(new URL("/clean", req.url));
}
