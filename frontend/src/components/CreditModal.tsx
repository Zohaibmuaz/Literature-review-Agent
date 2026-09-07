"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Check, Zap, ShieldCheck, Loader2 } from "lucide-react";

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onTopUp?: (addedCredits: number, packName: string) => Promise<void> | void;
  userId?: string;
  userEmail?: string;
  onRequireAuth?: () => void;
}

export function CreditModal({
  isOpen,
  onClose,
  currentCredits,
  onTopUp,
  userId,
  userEmail,
  onRequireAuth,
}: CreditModalProps) {
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectPack = async (tierKey: string, credits: number, name: string) => {
    if (!userId) {
      onClose();
      if (onRequireAuth) onRequireAuth();
      return;
    }

    setLoadingPack(name);
    try {
      const res = await fetch("/api/payment/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: tierKey,
          userId,
          userEmail: userEmail || "",
        }),
      });

      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        // Redirect to Safepay Checkout window (Cards, JazzCash, EasyPaisa)
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Could not initialize Safepay checkout.");
        setLoadingPack(null);
      }
    } catch (err) {
      console.error(err);
      alert("Network error connecting to Safepay.");
      setLoadingPack(null);
    }
  };

  const tiers = [
    {
      key: "starter",
      name: "Starter Pack",
      badge: "3 PAPERS",
      badgeColor: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
      credits: 3,
      price: "$4.99",
      pkrPrice: "Rs. 1,400",
      perPaper: "$1.66 / paper",
      description: "Ideal for 1-2 course term papers or thesis sub-chapters.",
      popular: false,
      accentBorder: "border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600",
      cardBg: "bg-white dark:bg-[#161922]",
      buttonClass: "bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white",
      features: [
        "3 Full 6,000+ Word Reviews",
        "20 ArXiv Verified Citations",
        "Academic Word & PDF Export",
        "Pay via Cards, JazzCash, EasyPaisa",
      ],
      buttonText: "Get 3 Papers ($4.99 • Rs. 1,400)",
    },
    {
      key: "researcher",
      name: "Researcher Pack",
      badge: "⭐ MOST POPULAR • SAVE 35%",
      badgeColor: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold",
      credits: 8,
      price: "$9.99",
      pkrPrice: "Rs. 2,800",
      perPaper: "$1.24 / paper",
      description: "Best for complete semester assignments & literature reviews.",
      popular: true,
      accentBorder: "border-blue-500 dark:border-blue-500 shadow-xl ring-4 ring-blue-500/15",
      cardBg: "bg-gradient-to-b from-blue-50/80 via-indigo-50/40 to-white dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-[#171925]",
      buttonClass: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25",
      features: [
        "8 Full 6,000+ Word Reviews",
        "Deep cross-paper taxonomy matrix",
        "Full Word & PDF with Zero Watermark",
        "Pay via Cards, JazzCash, EasyPaisa",
      ],
      buttonText: "Get 8 Papers ($9.99 • Rs. 2,800)",
    },
    {
      key: "scholar",
      name: "Scholar Pro",
      badge: "🔥 BEST VALUE • $1/PAPER",
      badgeColor: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
      credits: 20,
      price: "$19.99",
      pkrPrice: "Rs. 5,600",
      perPaper: "$1.00 / paper",
      description: "For thesis scholars, research labs & lab partners.",
      popular: false,
      accentBorder: "border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600",
      cardBg: "bg-white dark:bg-[#161922]",
      buttonClass: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25",
      features: [
        "20 Full Reviews (Only $1/paper!)",
        "Shareable with project partners",
        "Permanent Cloud Database Sync",
        "Pay via Cards, JazzCash, EasyPaisa",
      ],
      buttonText: "Get 20 Papers ($19.99 • Rs. 5,600)",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-5 sm:p-6 text-left animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Compact Header */}
        <div className="text-center max-w-lg mx-auto mb-3">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Top Up Scholar Credits
            </h2>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            Synthesize 6,000+ word academic reviews across 20 verified papers with IEEE / APA export.
          </p>

          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-xs font-bold text-blue-900 dark:text-blue-300">
            <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 fill-blue-600 dark:fill-cyan-400" />
            <span>Current Balance: <strong className="text-blue-950 dark:text-cyan-200">{currentCredits} {currentCredits === 1 ? 'Credit' : 'Credits'}</strong></span>
          </div>

          {successMessage && (
            <div className="mt-2 p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-in fade-in border border-emerald-200 dark:border-emerald-800">
              ✓ {successMessage}
            </div>
          )}
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-1">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${tier.cardBg} ${tier.accentBorder}`}
            >
              {tier.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md whitespace-nowrap">
                  Most Popular
                </span>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {tier.name}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tier.badgeColor}`}>
                    {tier.badge}
                  </span>
                </div>

                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mb-3 leading-snug">
                  {tier.description}
                </p>

                <div className="mb-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{tier.price}</span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">/ {tier.credits} papers</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 inline-block">
                    {tier.perPaper}
                  </span>
                </div>

                {/* Features List */}
                <ul className="space-y-2 mb-4 text-xs text-slate-800 dark:text-slate-200 font-medium">
                  {tier.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-tight">
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={loadingPack !== null}
                onClick={() => handleSelectPack(tier.key, tier.credits, tier.name)}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50 ${tier.buttonClass}`}
              >
                {loadingPack === tier.name ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting to Safepay...</span>
                  </>
                ) : (
                  <span>{tier.buttonText}</span>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Footer Guarantee */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Instant balance activation • Credits never expire</span>
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
            🔒 256-bit encrypted channel
          </div>
        </div>
      </div>
    </div>
  );
}
