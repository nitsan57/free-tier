import { NextResponse } from "next/server";
import {
  buildAuthUrl,
  createOAuthClient,
  getOAuthConfig
} from "@/lib/google/oauth";
import { generateOAuthState, setOAuthState } from "@/lib/session";

export async function GET() {
  try {
    getOAuthConfig();
  } catch {
    return NextResponse.json(
      { error: "OAuth not configured" },
      { status: 500 }
    );
  }

  const client = createOAuthClient();
  const state = generateOAuthState();
  const authUrl = buildAuthUrl(client, state);

  const res = NextResponse.redirect(authUrl);
  setOAuthState(res, state);
  return res;
}
