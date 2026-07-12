import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/billing";

function isSafeRedirect(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return false;
  try {
    const target = new URL(url);
    const origin = new URL(appUrl);
    return target.protocol === origin.protocol && target.host === origin.host;
  } catch {
    return false;
  }
}

const CheckoutSchema = z.object({
  successUrl: z.string().refine(isSafeRedirect, "Invalid or unsafe redirect URL"),
  cancelUrl: z.string().refine(isSafeRedirect, "Invalid or unsafe redirect URL")
});

export async function POST(req: NextRequest) {
  const parsed = CheckoutSchema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const stripe = getStripe();
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO;

  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: parsed.data.successUrl,
    cancel_url: parsed.data.cancelUrl
  });

  return NextResponse.json({ url: session.url });
}
