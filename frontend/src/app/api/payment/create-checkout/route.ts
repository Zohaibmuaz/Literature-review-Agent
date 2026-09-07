import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { packId, userId, userEmail } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User is required." }, { status: 401 });
    }

    const tierMap: Record<string, { credits: number; amount: number; name: string }> = {
      starter: { credits: 3, amount: 1400, name: "Starter Pack (3 Papers)" },
      researcher: { credits: 8, amount: 2800, name: "Researcher Pack (8 Papers)" },
      scholar: { credits: 20, amount: 5600, name: "Scholar Pro (20 Papers)" },
    };

    const selectedTier = tierMap[packId] || tierMap["researcher"];

    const env = process.env.NEXT_PUBLIC_SAFEPAY_ENV || "sandbox";
    const baseUrl =
      env === "production"
        ? "https://api.getsafepay.com"
        : "https://sandbox.api.getsafepay.com";

    const clientKey = process.env.NEXT_PUBLIC_SAFEPAY_PUBLIC_KEY;
    const secretKey = process.env.SAFEPAY_SECRET_KEY;

    if (!clientKey || !secretKey) {
      return NextResponse.json(
        { error: "Safepay API credentials are not configured on server." },
        { status: 500 }
      );
    }

    // Call Safepay /order/v1/init
    const res = await fetch(`${baseUrl}/order/v1/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SFPY-MERCHANT-SECRET": secretKey,
      },
      body: JSON.stringify({
        client: clientKey,
        amount: selectedTier.amount,
        currency: "PKR",
        environment: env,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Safepay init error:", errText);
      return NextResponse.json(
        { error: "Failed to initialize payment with Safepay." },
        { status: 502 }
      );
    }

    const result = await res.json();
    const token = result?.data?.token;

    if (!token) {
      return NextResponse.json(
        { error: "No tracker token returned by Safepay." },
        { status: 502 }
      );
    }

    // Determine host origin for redirect
    const host = req.headers.get("origin") || req.headers.get("referer") || "http://localhost:3000";
    const redirectUrl = `${host}/api/payment/callback?tracker=${token}&credits=${selectedTier.credits}&user_id=${userId}&pack=${encodeURIComponent(selectedTier.name)}`;
    const cancelUrl = `${host}/payment/cancel`;
    const orderId = `order_${Date.now()}`;

    // Build Safepay hosted checkout URL
    const checkoutUrl = `${baseUrl}/checkout/pay?beacon=${token}&env=${env}&source=custom&order_id=${orderId}&redirect_url=${encodeURIComponent(
      redirectUrl
    )}&cancel_url=${encodeURIComponent(cancelUrl)}`;

    return NextResponse.json({
      checkoutUrl,
      token,
      credits: selectedTier.credits,
      amount: selectedTier.amount,
      currency: "PKR",
    });
  } catch (err: any) {
    console.error("Error creating Safepay checkout:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
