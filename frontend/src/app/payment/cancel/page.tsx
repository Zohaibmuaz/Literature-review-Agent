"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function PaymentCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0c10] text-slate-900 dark:text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#141721] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 mx-auto flex items-center justify-center mb-4">
          <XCircle className="w-9 h-9" />
        </div>

        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Payment Cancelled
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          Your Safepay checkout session was not completed. No charges were made to your card or wallet.
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full py-2.5 px-4 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Editor</span>
          </button>
        </div>
      </div>
    </div>
  );
}
