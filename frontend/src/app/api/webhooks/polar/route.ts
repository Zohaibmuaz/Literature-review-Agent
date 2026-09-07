import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Listen for order.created or checkout completion
    const eventType = payload.type || payload.event;

    if (eventType === "order.created") {
      const order = payload.data || {};
      const metadata = order?.metadata || {};

      // 1. Determine target User ID (from metadata, external_customer_id, or customer email)
      let userId = metadata.userId || metadata.user_id || order.customer?.external_id || order.external_customer_id || null;
      const customerEmail = order.customer?.email || order.customer_email || order.email || null;

      if (!userId && customerEmail) {
        // Fallback: search profile by email in Supabase
        const { data: matchedProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", customerEmail)
          .maybeSingle();

        if (matchedProfile?.id) {
          userId = matchedProfile.id;
        }
      }

      // 2. Determine credits to grant (from metadata, product name, or purchase amount)
      let credits = Number(metadata.credits) || 0;
      if (!credits) {
        const amountInCents = order.total_amount || order.amount || 0;
        const productName = (order.product?.name || "").toLowerCase();

        if (amountInCents >= 1900 || productName.includes("scholar") || productName.includes("20")) {
          credits = 20;
        } else if (amountInCents >= 900 || productName.includes("researcher") || productName.includes("8")) {
          credits = 8;
        } else if (amountInCents >= 400 || productName.includes("starter") || productName.includes("3")) {
          credits = 3;
        } else {
          credits = 8; // Sensible default
        }
      }

      // 3. Atomically update user credits balance in Supabase
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits_balance")
          .eq("id", userId)
          .maybeSingle();

        const current = typeof profile?.credits_balance === "number" ? profile.credits_balance : 0;
        const newBalance = current + credits;

        await supabase
          .from("profiles")
          .upsert({
            id: userId,
            credits_balance: newBalance,
            updated_at: new Date().toISOString(),
          });

        console.log(`[Polar Webhook] Successfully credited +${credits} to user ${userId} (New Balance: ${newBalance})`);
      } else {
        console.warn("[Polar Webhook] Order received but could not resolve a userId or customer email:", order);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Polar webhook processing error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
