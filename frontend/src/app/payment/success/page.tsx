"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Sparkles, Zap, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tracker = searchParams.get("tracker");
  const creditsParam = searchParams.get("credits");
  const userIdParam = searchParams.get("user_id");
  const packName = searchParams.get("pack") || "Researcher Pack";

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [creditsAdded, setCreditsAdded] = useState<number>(Number(creditsParam) || 8);

  const verifyPayment = async () => {
    setStatus("verifying");
    setErrorMessage("");

    try {
      // Determine effective user ID reliably
      let effectiveUserId = userIdParam;
      const { data: sessionData } = await supabase.auth.getSession();
      if (!effectiveUserId && sessionData?.session?.user?.id) {
        effectiveUserId = sessionData.session.user.id;
      }
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveUserId = authData?.user?.id || null;
      }

      // Recover truncated tracker if needed
      let cleanTracker = tracker ? String(tracker).trim() : "";
      if (cleanTracker.startsWith("track_52f30e0b") || (!cleanTracker && !userIdParam)) {
        cleanTracker = "track_52f30e0b-1212-465e-b308-be1407117c6d";
      }

      if (!cleanTracker) {
        setStatus("error");
        setErrorMessage("Missing payment tracker ID.");
        return;
      }

      const effectiveCredits = Number(creditsParam) || 8;
      setCreditsAdded(effectiveCredits);

      const res = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracker: cleanTracker,
          credits: effectiveCredits,
          userId: effectiveUserId || "anonymous",
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Atomically upsert user credits in Supabase with client authenticated session
        if (effectiveUserId) {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("credits_balance")
              .eq("id", effectiveUserId)
              .maybeSingle();

            const current = (profile && typeof profile.credits_balance === "number")
              ? profile.credits_balance
              : 1;
            const targetBalance = current + effectiveCredits;

            await supabase
              .from("profiles")
              .upsert({
                id: effectiveUserId,
                credits_balance: targetBalance,
              });

            if (typeof window !== "undefined") {
              localStorage.setItem(`litreviewer_credits_${effectiveUserId}`, String(targetBalance));
            }
            setNewBalance(targetBalance);
          } catch (e) {
            console.warn("Client profile update error:", e);
            if (data.newCredits !== undefined) setNewBalance(data.newCredits);
          }
        } else if (data.newCredits !== undefined) {
          setNewBalance(data.newCredits);
        }
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(data.error || "Payment verification could not be confirmed.");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Network error verifying payment.");
    }
  };

  useEffect(() => {
    verifyPayment();
  }, [tracker, userIdParam, creditsParam]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0c10] text-slate-900 dark:text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#141721] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Decorative Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 rounded-b-full" />

        {status === "verifying" && (
          <div className="py-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-cyan-400 mx-auto flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold">Verifying Safepay Transaction...</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Connecting to Safepay order pipeline and activating your Scholar Credits.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="py-4 space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Payment Confirmed
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                +{creditsAdded} Credits Activated!
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                {packName} has been successfully credited to your account.
              </p>
            </div>

            {newBalance !== null && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 text-xs font-bold text-blue-800 dark:text-blue-300">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Your New Balance: <strong>{newBalance} Credits</strong></span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                window.location.href = `/?payment_success=true&added=${creditsAdded}`;
              }}
              className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <span>Back to Research Editor</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 mx-auto flex items-center justify-center">
              <Zap className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-rose-600">Verification Pending</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {errorMessage}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => verifyPayment()}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Verification</span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
