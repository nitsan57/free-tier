import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { getSession, getValidAccessToken, SessionData } from "@/lib/session";
import { PhotosClient } from "@/lib/google/photos";
import { FREE_MONTHLY_DELETION_LIMIT } from "@/lib/billing";
import {
  remainingDeletions,
  wouldExceedLimit,
  getUsage,
  recordDeletions
} from "@/lib/usage";

const DeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  dryRun: z.boolean().optional().default(false)
});

function userKey(session: SessionData): string {
  const raw = session.googleRefreshToken ?? session.googleAccessToken;
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { ids, dryRun } = parsed.data;
  const key = userKey(session);
  const remaining = remainingDeletions(key);

  if (!dryRun && wouldExceedLimit(key, ids.length)) {
    return NextResponse.json(
      {
        error: "Monthly deletion limit reached",
        limit: FREE_MONTHLY_DELETION_LIMIT,
        used: getUsage(key),
        remaining
      },
      { status: 403 }
    );
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      requested: ids.length,
      remaining
    });
  }

  const client = new PhotosClient(async (force) => {
    const token = await getValidAccessToken(force);
    if (!token) throw new Error("No valid Google access token");
    return token;
  });
  try {
    await client.batchDelete(ids);
  } catch (e) {
    return NextResponse.json(
      { error: "Delete failed", message: (e as Error).message },
      { status: 502 }
    );
  }

  recordDeletions(key, ids.length);

  return NextResponse.json({
    ok: true,
    dryRun: false,
    deleted: ids.length,
    remaining: remainingDeletions(key)
  });
}
