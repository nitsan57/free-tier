import { NextResponse } from "next/server";
import { clearOAuthState, clearSession } from "@/lib/session";

export async function POST() {
  clearSession();
  clearOAuthState();
  return NextResponse.json({ ok: true });
}
