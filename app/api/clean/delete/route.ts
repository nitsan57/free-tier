import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  dryRun: z.boolean().optional().default(false)
});

export async function POST(req: NextRequest) {
  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, dryRun: parsed.data.dryRun });
}
