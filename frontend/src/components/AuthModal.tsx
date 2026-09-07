"use client";

import React, { useEffect } from "react";
import { X, Sparkles, BookOpen, Layers, CheckCircle2 } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn: () => void;
  title?: string;
  description?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  onGoogleSignIn,
  title = "Unlock Full Academic Manuscript",
  description = "Sign in to synthesize all 20 papers and generate the comprehensive 6,000+ word literature review.",
}: AuthModalProps) {
  // Close on Escape key press
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden p-6 sm:p-7 text-left animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Icon Badge */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
          <Sparkles className="w-6 h-6 text-amber-300" />
        </div>

        {/* Title & Subtitle */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
          {title}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
          {description}
        </p>

        {/* Value Proposition List */}
        <div className="my-5 p-3.5 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-800 space-y-2.5">
          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Full 20-Paper deep synthesis (6,000+ words)</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <Layers className="w-4 h-4 text-blue-500 shrink-0" />
            <span>5 exhaustive sections & thematic taxonomies</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Complete IEEE & APA academic citations</span>
          </div>
        </div>

        {/* 1-Click Google Sign In CTA */}
        <button
          type="button"
          onClick={onGoogleSignIn}
          className="w-full py-3 px-4 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/80 text-gray-800 dark:text-white font-semibold text-xs border border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] group"
        >
          <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.37 7.36 24 12 24z" />
            <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.24C.45 8.14 0 9.99 0 12s.45 3.86 1.24 5.42l4.04-3.13z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.63 1.24 6.58l4.04 3.13c.95-2.83 3.6-4.96 6.72-4.96z" />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Microcopy Guarantee */}
        <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-3 tracking-wide">
          100% Free • No password required • Instant scholar access
        </p>
      </div>
    </div>
  );
}
