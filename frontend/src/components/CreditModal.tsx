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
      const selectedTier = tiers.find((t) => t.key === tierKey) || tiers[1];
      const host = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const returnUrl = `${host}/payment/success?credits=${credits}&user_id=${userId}&pack=${encodeURIComponent(name)}`;
      
      // Build Polar checkout redirect with official success_url and customer_email
      const polarUrl = new URL(selectedTier.polarLink);
      polarUrl.searchParams.set("success_url", returnUrl);
      polarUrl.searchParams.set("confirmation_url", returnUrl);
      if (userEmail) {
        polarUrl.searchParams.set("customer_email", userEmail);
      }

      window.location.href = polarUrl.toString();
    } catch (err) {
      console.error("Polar checkout redirect error:", err);
      alert("Could not initialize checkout. Please try again.");
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
        "Apple Pay, Google Pay, Cards",
      ],
      buttonText: "Get 3 Papers ($4.99)",
      polarLink: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_dW8sKrSaTu3qomBYxesDgitWar1DAjRIQ6tUx2d9lex/redirect",
    },
    {
      key: "researcher",
      name: "Researcher Pack",
      badge: "⭐ MOST POPULAR • SAVE 35%",
      badgeColor: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold",
      credits: 8,
      price: "$9.99",
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
        "Apple Pay, Google Pay, Cards",
      ],
      buttonText: "Get 8 Papers ($9.99)",
      polarLink: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_edzkB4PS35uyg7JmugmSKgNQ90c0o6v9aHFko08dpQL/redirect",
    },
    {
      key: "scholar",
      name: "Scholar Pro",
      badge: "🔥 BEST VALUE • $1/PAPER",
      badgeColor: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
      credits: 20,
      price: "$19.99",
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
        "Apple Pay, Google Pay, Cards",
      ],
      buttonText: "Get 20 Papers ($19.99)",
      polarLink: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_gx9iDTeV7A3v2GE2ezQipu4YInK4jg4LfK9KW3Tu6bO/redirect",
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[92dvh] sm:max-h-[90vh] rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col text-left animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Modal Header */}
        <div className="relative p-3.5 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-[#131620]/95 backdrop-blur-xs shrink-0">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center max-w-lg mx-auto pr-7 sm:pr-0">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Top Up Scholar Credits
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-1 sm:line-clamp-none">
              Synthesize 6,000+ word academic reviews across 20 verified papers with IEEE / APA export.
            </p>

            <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-[11px] sm:text-xs font-bold text-blue-900 dark:text-blue-300">
              <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 fill-blue-600 dark:fill-cyan-400" />
              <span>Current Balance: <strong className="text-blue-950 dark:text-cyan-200">{currentCredits} {currentCredits === 1 ? 'Credit' : 'Credits'}</strong></span>
            </div>

            {successMessage && (
              <div className="mt-2 p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-in fade-in border border-emerald-200 dark:border-emerald-800">
                ✓ {successMessage}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Pricing Cards Container */}
        <div className="p-3.5 sm:p-6 overflow-y-auto overscroll-contain flex-1">
          {/* Mobile Quick Tier Navigation Pills */}
          <div className="flex md:hidden items-center justify-center gap-1.5 mb-3 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
            {tiers.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  const el = document.getElementById(`tier-card-${t.key}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className="flex-1 py-1 px-1.5 text-[11px] font-bold rounded-lg transition-all text-center text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 shadow-2xs cursor-pointer active:scale-95"
              >
                {t.credits} Papers {t.popular && "⭐"}
              </button>
            ))}
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 my-1">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                id={`tier-card-${tier.key}`}
                className={`relative rounded-xl p-3.5 sm:p-5 flex flex-col justify-between transition-all border ${tier.cardBg} ${tier.accentBorder}`}
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

                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mb-2.5 leading-snug">
                    {tier.description}
                  </p>

                  <div className="mb-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800/80">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{tier.price}</span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">/ {tier.credits} papers</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 inline-block">
                      {tier.perPaper}
                    </span>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-1.5 sm:space-y-2 mb-3.5 text-[11px] sm:text-xs text-slate-800 dark:text-slate-200 font-medium">
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
                      <span>Connecting to Checkout...</span>
                    </>
                  ) : (
                    <span>{tier.buttonText}</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sticky Footer Guarantee */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#0f1118]/80 flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Instant activation • Credits never expire</span>
          </div>
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            🔒 256-bit encrypted
          </div>
        </div>
      </div>
    </div>
  );
}
