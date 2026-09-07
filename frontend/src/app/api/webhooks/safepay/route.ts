import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-sfpy-signature") || "";
    const secretKey = process.env.SAFEPAY_SECRET_KEY || "";

    // Verify signature if present and secretKey exists
    if (signature && secretKey) {
      const hmac = crypto.createHmac("sha256", secretKey).update(rawBody).digest("hex");
      if (hmac !== signature) {
        console.warn("Safepay webhook signature mismatch.");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event || payload.type;
    const orderData = payload.data;

    console.log("[Safepay Webhook Received]:", eventType, orderData?.token);

    // If payment completed/succeeded
    if (
      eventType === "payment.created" ||
      eventType === "order.completed" ||
      orderData?.state === "PAID" ||
      orderData?.state === "TRACKER_ENDED"
    ) {
      const metadata = orderData?.metadata || {};
      const userId = metadata.user_id || orderData?.client_reference_id;
      const credits = Number(metadata.credits || 0);

      if (userId && credits > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits_balance")
          .eq("id", userId)
          .single();

        const newBalance = (profile?.credits_balance || 0) + credits;

        await supabase
          .from("profiles")
          .upsert({
            id: userId,
            credits_balance: newBalance,
          })
          .eq("id", userId);

        console.log(`[Safepay Webhook] Added +${credits} credits to user ${userId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Safepay webhook processing error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
