import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  return handleCallback(req);
}

export async function GET(req: Request) {
  return handleCallback(req);
}

async function handleCallback(req: Request) {
  try {
    const url = new URL(req.url);

    let tracker =
      url.searchParams.get("tracker") ||
      url.searchParams.get("beacon") ||
      "";
    let creditsStr = url.searchParams.get("credits") || "";
    let userId = url.searchParams.get("user_id") || "";
    let pack = url.searchParams.get("pack") || "Scholar Pack";

    const contentType = req.headers.get("content-type") || "";

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      try {
        const formData = await req.formData();
        tracker =
          (formData.get("tracker") as string) ||
          (formData.get("beacon") as string) ||
          (formData.get("token") as string) ||
          tracker;
        userId = (formData.get("user_id") as string) || userId;
        creditsStr = (formData.get("credits") as string) || creditsStr;
        pack = (formData.get("pack") as string) || pack;
      } catch (e) {
        console.warn("Could not parse form data in Safepay callback:", e);
      }
    } else if (contentType.includes("application/json")) {
      try {
        const json = await req.json();
        tracker =
          json.tracker ||
          json.beacon ||
          json.token ||
          tracker;
        userId = json.user_id || userId;
        creditsStr = json.credits || creditsStr;
        pack = json.pack || pack;
      } catch (e) {
        console.warn("Could not parse JSON in Safepay callback:", e);
      }
    }

    const host =
      req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("x-forwarded-host")}`
        : url.origin || "http://localhost:3000";

    if (!tracker) {
      return NextResponse.redirect(`${host}/payment/cancel?error=missing_tracker`, 303);
    }

    const credits = Number(creditsStr) || 8;

    // Verify tracker state with Safepay API
    const env = process.env.NEXT_PUBLIC_SAFEPAY_ENV || "sandbox";
    const baseUrl =
      env === "production"
        ? "https://api.getsafepay.com"
        : "https://sandbox.api.getsafepay.com";

    const secretKey = process.env.SAFEPAY_SECRET_KEY;

    if (secretKey) {
      try {
        const res = await fetch(`${baseUrl}/order/v1/${tracker}`, {
          method: "GET",
          headers: {
            "X-SFPY-MERCHANT-SECRET": secretKey,
          },
        });

        if (res.ok) {
          const result = await res.json();
          const order = result?.data;
          const orderState = order?.state;

          const isSuccess =
            orderState === "PAID" ||
            orderState === "TRACKER_ENDED" ||
            orderState === "COMPLETED";

          if (isSuccess && userId) {
            // Fetch current balance
            const { data: profile } = await supabase
              .from("profiles")
              .select("credits_balance")
              .eq("id", userId)
              .single();

            const currentBalance = profile?.credits_balance || 0;
            const newBalance = currentBalance + credits;

            await supabase
              .from("profiles")
              .upsert({
                id: userId,
                credits_balance: newBalance,
              })
              .eq("id", userId);
          }
        }
      } catch (vErr) {
        console.error("Safepay verification error inside callback:", vErr);
      }
    }

    // 303 See Other Redirect converts browser POST from Safepay to a clean GET for the frontend
    const successUrl = new URL("/payment/success", host);
    successUrl.searchParams.set("tracker", tracker);
    successUrl.searchParams.set("credits", String(credits));
    if (userId) successUrl.searchParams.set("user_id", userId);
    successUrl.searchParams.set("pack", pack);

    return NextResponse.redirect(successUrl.toString(), 303);
  } catch (err: any) {
    console.error("Error in Safepay callback:", err);
    return NextResponse.redirect(new URL("/payment/cancel?error=exception", req.url), 303);
  }
}
