"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useReactToPrint } from "react-to-print";
import { useTheme } from "next-themes";
import { Loader2, History, BrainCircuit, Moon, Sun, Sparkles, Download, MessageSquare, Share2, ChevronDown, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, Link as LinkIcon, MoreHorizontal, RefreshCw, BookOpen, Trash2, Clock, X, GraduationCap, Zap, Lock, LogOut, Plus } from "lucide-react";
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { supabase } from "@/lib/supabase";
import { AuthModal } from "@/components/AuthModal";
import { CreditModal } from "@/components/CreditModal";
import type { User } from "@supabase/supabase-js";

export default function Home() {
  const [topic, setTopic] = useState("");
  const [author, setAuthor] = useState("");
  const [institution, setInstitution] = useState("");
  const [citationStyle, setCitationStyle] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState("");
  const [error, setError] = useState("");
  
  const [currentAgent, setCurrentAgent] = useState("");
  const [agentMessage, setAgentMessage] = useState("");
  const [fetchedPapers, setFetchedPapers] = useState<any[]>([]);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [generationMode, setGenerationMode] = useState<"preview" | "full">("preview");
  const [lastGeneratedMode, setLastGeneratedMode] = useState<"preview" | "full">("preview");
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);

  // Supabase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Mobile responsive layout states
  const [mobileTab, setMobileTab] = useState<"tracker" | "paper">("paper");
  const [showMobileSetup, setShowMobileSetup] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-expand current active step
  useEffect(() => {
    if (currentAgent === "Research Crawler") setExpandedStep(1);
    if (currentAgent === "Data Engineer") setExpandedStep(2);
    if (currentAgent === "Content Writer") setExpandedStep(3);
  }, [currentAgent]);


  const componentRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Research_Paper_${topic.replace(/\s+/g, '_')}`,
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  interface HistoryItem {
    id: string;
    user_id?: string;
    topic: string;
    author: string;
    institution: string;
    citation_style: string;
    review: string;
    created_at?: string;
    timestamp?: number;
    mode?: "preview" | "full";
  }

  // Fetch papers from Supabase cloud database
  const fetchUserHistory = async (userId: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("papers")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not fetch user papers from cloud:", error);
      } else if (data) {
        setHistory(data);
      }
    } catch (err) {
      console.warn("Error fetching cloud history:", err);
    }
  };

  // Fetch credits balance from Supabase profiles
  const fetchUserCredits = async (userId: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Could not fetch user credits from Supabase:", error);
        // Fallback to local cache if network/DB error occurs, but NEVER overwrite Supabase
        if (typeof window !== "undefined") {
          const cachedStr = localStorage.getItem(`litreviewer_credits_${userId}`);
          if (cachedStr !== null) {
            setCredits(parseInt(cachedStr, 10));
          }
        }
        return;
      }

      // If user profile exists and has a numeric credits balance (including 0!)
      if (data && typeof data.credits_balance === "number") {
        const authoritativeBal = data.credits_balance;
        setCredits(authoritativeBal);
        if (typeof window !== "undefined") {
          localStorage.setItem(`litreviewer_credits_${userId}`, String(authoritativeBal));
        }
      } else {
        // Profile row doesn't exist yet in Supabase. Check local cache before assuming 1:
        if (typeof window !== "undefined") {
          const cachedStr = localStorage.getItem(`litreviewer_credits_${userId}`);
          if (cachedStr !== null) {
            // Respect previously known balance (e.g., 0)
            setCredits(parseInt(cachedStr, 10));
            return;
          }
        }
        // If brand new user with no record anywhere: default to 1 credit
        setCredits(1);
      }
    } catch (err) {
      console.warn("Error fetching user credits:", err);
    }
  };

  // Top up credits handler for CreditModal
  const handleTopUpCredits = async (addedCredits: number, packName: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    try {
      const newBalance = (credits || 0) + addedCredits;
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, email: user.email || "", credits_balance: newBalance });

      if (error) {
        console.error("Error updating credits in Supabase:", error);
      } else {
        setCredits(newBalance);
        if (typeof window !== "undefined") {
          localStorage.setItem(`litreviewer_credits_${user.id}`, String(newBalance));
        }
      }
    } catch (err) {
      console.error("Top-up credits error:", err);
    }
  };

  // Save generated paper to Supabase cloud database
  const saveToCloudHistory = async (item: {
    topic: string;
    author: string;
    institution: string;
    citation_style: string;
    review: string;
    mode?: "preview" | "full";
  }) => {
    if (!user || !item.review || !item.review.trim()) return;
    try {
      const newRow = {
        user_id: user.id,
        topic: item.topic || "Untitled Research Paper",
        author: item.author || "LitReviewer AI",
        institution: item.institution || "",
        citation_style: item.citation_style || "IEEE",
        review: item.review,
        mode: item.mode || "full",
      };

      const { data, error } = await supabase
        .from("papers")
        .insert(newRow)
        .select()
        .single();

      if (!error && data) {
        setHistory((prev) => [data, ...prev.filter((p) => p.id !== data.id)]);
      }

      // Deduct 1 credit for full paper if user is logged in
      if (item.mode === "full" && user) {
        try {
          // 1. First attempt atomic RPC deduction in PostgreSQL
          const { data: rpcBal, error: rpcErr } = await supabase.rpc("deduct_user_credit", {
            user_uuid: user.id,
          });

          let newBal: number;
          if (!rpcErr && typeof rpcBal === "number") {
            newBal = rpcBal;
          } else {
            // 2. Fallback direct upsert in Supabase
            newBal = Math.max(0, credits - 1);
            const { error: upsertErr } = await supabase
              .from("profiles")
              .upsert({
                id: user.id,
                email: user.email || "",
                credits_balance: newBal,
                updated_at: new Date().toISOString(),
              });
            if (upsertErr) {
              console.warn("Direct profile credit upsert notice:", upsertErr.message);
            }
          }

          setCredits(newBal);
          if (typeof window !== "undefined") {
            localStorage.setItem(`litreviewer_credits_${user.id}`, String(newBal));
          }
        } catch (err) {
          console.error("Failed to persist deducted credit:", err);
        }
      }
    } catch (err) {
      console.warn("Could not save to cloud history:", err);
    }
  };

  // Delete single paper from Supabase cloud database
  const deleteFromCloudHistory = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await supabase.from("papers").delete().eq("id", id);
      setHistory((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.warn("Could not delete from cloud history:", err);
    }
  };

  // Clear all papers for the current logged-in user
  const clearAllCloudHistory = async () => {
    if (!user) return;
    if (window.confirm("Are you sure you want to delete all your saved papers from your account?")) {
      try {
        await supabase.from("papers").delete().eq("user_id", user.id);
        setHistory([]);
      } catch (err) {
        console.warn("Could not clear cloud history:", err);
      }
    }
  };

  const formatTimestamp = (ts?: number | string) => {
    if (!ts) return "";
    const timeMs = typeof ts === "string" ? new Date(ts).getTime() : ts;
    const diff = Date.now() - timeMs;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 7) return `${days}d ago`;
    return new Date(timeMs).toLocaleDateString();
  };

  const GUEST_RUNS_KEY = "litreviewer_guest_run_count_v1";
  const getGuestRuns = (): number => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem(GUEST_RUNS_KEY) || "0", 10);
  };

  const incrementGuestRuns = () => {
    if (typeof window === "undefined") return;
    const current = getGuestRuns();
    localStorage.setItem(GUEST_RUNS_KEY, (current + 1).toString());
  };

  // Supabase session initialization and auth state change listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserHistory(currentUser.id);
        fetchUserCredits(currentUser.id);
      } else {
        setHistory([]);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserHistory(currentUser.id);
        fetchUserCredits(currentUser.id);
      } else {
        setHistory([]);
      }

      if (event === "SIGNED_IN" && currentUser) {
        setShowAuthModal(false);
        const pendingFull = sessionStorage.getItem("litreviewer_pending_full_gen");
        if (pendingFull) {
          sessionStorage.removeItem("litreviewer_pending_full_gen");
          setTimeout(() => {
            triggerGeneration("full");
          }, 300);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [topic, author, institution, citationStyle]);

  // Handle return from successful payment
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_success") === "true") {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const u = session?.user;
        if (u) {
          fetchUserCredits(u.id);
        }
      });
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Click outside to close user dropdown & export dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignInWithGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
    } catch (err) {
      console.error("Google OAuth error:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setCredits(0);
      setShowUserDropdown(false);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const triggerGeneration = async (modeOverride?: "preview" | "full") => {
    const runMode = modeOverride || generationMode;
    if (modeOverride) {
      setGenerationMode(modeOverride);
    }
    if (!topic.trim()) return;

    // Silent Guest Limit Check (2 free previews max for guests)
    if (runMode === "preview" && !user && getGuestRuns() >= 2) {
      setShowGuestLimitModal(true);
      return;
    }

    // Gate full generation if not signed in
    if (runMode === "full" && !user) {
      sessionStorage.setItem("litreviewer_pending_full_gen", "true");
      setShowAuthModal(true);
      return;
    }

    // Gate full generation if user has 0 credits remaining
    if (runMode === "full" && user && credits <= 0) {
      setShowCreditModal(true);
      return;
    }

    setLoading(true);
    setError("");
    setReview("");
    setShowHistory(false);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileTab("tracker");
    }
    
    setCurrentAgent("Research Crawler");
    setAgentMessage(`Connecting to research network (${runMode === 'preview' ? 'Quick Blueprint' : 'Full Paper'})...`);
    setFetchedPapers([]);

    class FatalError extends Error {}

    try {
      let isDone = false;
      const ctrl = new AbortController();
      let accumulatedReview = "";

      await fetchEventSource(`${API_URL}/stream-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          topic, 
          author, 
          institution, 
          citation_style: citationStyle, 
          mode: runMode 
        }),
        signal: ctrl.signal,
        openWhenHidden: true,
        onmessage(ev) {
          const data = JSON.parse(ev.data);
          
          if (data.type === 'status') {
            setCurrentAgent(data.agent);
            setAgentMessage(data.message);
            if (data.data && data.data.papers) {
              setFetchedPapers(data.data.papers);
            }
          } else if (data.type === 'token') {
            accumulatedReview += data.content;
            setReview((prev) => prev + data.content);
          } else if (data.type === 'done') {
             isDone = true;
             setLoading(false);
             if (typeof window !== "undefined" && window.innerWidth < 1024) {
               setMobileTab("paper");
             }
             const finalContent = data.review || accumulatedReview;
             const finalMode = data.mode || runMode;
             setLastGeneratedMode(finalMode);
             if (data.review) {
               setReview(data.review);
             }
             if (finalContent && finalContent.trim().length > 0 && user) {
               saveToCloudHistory({
                 topic,
                 author: author || "LitReviewer AI",
                 institution,
                 citation_style: citationStyle || "IEEE",
                 review: finalContent,
                 mode: finalMode,
               });
             }
             if (finalMode === "preview" && !user) {
               incrementGuestRuns();
             }
             ctrl.abort(); // Stop fetchEventSource from retrying
             throw new FatalError("Stream completed successfully.");
          } else if (data.type === 'error') {
             setError(data.message);
             setLoading(false);
             ctrl.abort();
             throw new FatalError(data.message);
          }
        },
        onclose() {
          if (!isDone) {
            setLoading(false);
          }
          ctrl.abort();
          throw new FatalError("Stream closed, preventing retry.");
        },
        onerror(err) {
          if (err instanceof FatalError) {
              throw err; // Stop retrying!
          }
          console.warn("Stream error:", err);
          setError("Connection lost or backend error.");
          setLoading(false);
          ctrl.abort();
          throw new FatalError("Stream errored, preventing retry.");
        }
      });
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerGeneration(user ? "full" : "preview");
  };

  const loadHistoryItem = (item: any) => {
    if (item.topic) setTopic(item.topic);
    if (item.author) setAuthor(item.author);
    if (item.institution) setInstitution(item.institution);
    if (item.citation_style) setCitationStyle(item.citation_style);
    if (item.review) setReview(item.review);
    if (item.mode) {
      setGenerationMode(item.mode);
      setLastGeneratedMode(item.mode);
    }
    setShowHistory(false);
  };

  const handleDownloadWord = () => {
    if (!componentRef.current || !review) return;

    // Academic Metadata
    const docTitle = topic.trim() || "Literature Review Paper";
    const docAuthor = author.trim() || "Scholar Author";
    const docInstitution = institution.trim() || "Academic Department";
    const docCitationStyle = citationStyle || "IEEE / APA Standard";
    const docDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let rawArticleHtml = "";
    try {
      const articleElem = (componentRef.current as HTMLElement).querySelector("article");
      if (articleElem) {
        // Clone node so we can sanitize without mutating the live UI
        const clone = articleElem.cloneNode(true) as HTMLElement;

        // Remove UI controls and typing indicators
        const uiArtifacts = clone.querySelectorAll(".no-print, [role='status'], button");
        uiArtifacts.forEach((el) => el.remove());

        // Remove raw initial H1 and author paragraph from AI text to prevent duplicate title block
        const firstH1 = clone.querySelector("h1");
        if (firstH1) {
          const nextP = firstH1.nextElementSibling;
          if (nextP && nextP.tagName === "P" && (nextP.textContent?.toLowerCase().includes("author") || nextP.textContent?.toLowerCase().includes("institution"))) {
            nextP.remove();
          }
          firstH1.remove();
        }

        // Clean classes and attributes to strip Tailwind classes
        const allElements = clone.querySelectorAll("*");
        allElements.forEach((el) => {
          el.removeAttribute("class");
          el.removeAttribute("id");
          el.removeAttribute("style");
        });

        // Detect References heading and insert Word section/page break before it
        const headings = clone.querySelectorAll("h1, h2, h3");
        headings.forEach((h) => {
          const text = (h.textContent || "").toLowerCase();
          if (text.includes("reference") || text.includes("bibliography") || text.includes("works cited")) {
            const pageBreak = document.createElement("div");
            pageBreak.setAttribute("style", "page-break-before: always; mso-break-type: section-break; clear: both;");
            h.parentNode?.insertBefore(pageBreak, h);
          }
        });

        rawArticleHtml = clone.innerHTML;
      }
    } catch (err) {
      console.warn("Error cloning article for Word export:", err);
    }

    if (!rawArticleHtml) {
      rawArticleHtml = `<p>${review.replace(/\n\n/g, "</p><p>")}</p>`;
    }

    // Publication-Grade Microsoft Word HTML Document
    const wordXml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${docTitle}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page WordSection1 {
            size: 8.5in 11.0in;
            margin: 1.0in 1.0in 1.0in 1.0in;
            mso-header-margin: 0.5in;
            mso-footer-margin: 0.5in;
            mso-paper-source: 0;
          }
          div.WordSection1 {
            page: WordSection1;
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000000;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
          }
          h1, h2, h3, h4, h5, h6, p, div, span, li, blockquote, a {
            font-family: "Times New Roman", Times, serif;
            color: #000000 !important;
          }
          .title-block {
            text-align: center;
            margin-bottom: 24pt;
          }
          .paper-title {
            font-size: 18pt;
            font-weight: bold;
            text-align: center;
            margin-top: 0;
            margin-bottom: 8pt;
            line-height: 1.3;
          }
          .paper-author {
            font-size: 12pt;
            font-weight: bold;
            text-align: center;
            margin: 0 0 4pt 0;
          }
          .paper-institution {
            font-size: 11pt;
            font-style: italic;
            text-align: center;
            margin: 0 0 6pt 0;
          }
          .paper-meta {
            font-size: 9.5pt;
            text-align: center;
            color: #444444;
            margin: 0 0 16pt 0;
          }
          .title-divider {
            border: 0;
            border-top: 1.5px solid #000000;
            margin: 12pt auto 20pt auto;
            width: 100%;
          }
          h1 {
            font-size: 16pt;
            font-weight: bold;
            text-align: center;
            margin-top: 18pt;
            margin-bottom: 8pt;
          }
          h2 {
            font-size: 13pt;
            font-weight: bold;
            text-align: left;
            margin-top: 18pt;
            margin-bottom: 6pt;
            border-bottom: 1px solid #000000;
            padding-bottom: 2pt;
          }
          h3 {
            font-size: 12pt;
            font-weight: bold;
            font-style: italic;
            text-align: left;
            margin-top: 14pt;
            margin-bottom: 4pt;
          }
          p {
            font-size: 12pt;
            line-height: 1.5;
            text-align: justify;
            margin-top: 0pt;
            margin-bottom: 8pt;
          }
          blockquote {
            font-size: 11pt;
            font-style: italic;
            margin-left: 0.5in;
            margin-right: 0.5in;
            margin-top: 8pt;
            margin-bottom: 8pt;
            border-left: 2.5px solid #000000;
            padding-left: 10pt;
          }
          ul, ol {
            margin-top: 4pt;
            margin-bottom: 8pt;
            padding-left: 0.35in;
          }
          li {
            font-size: 12pt;
            line-height: 1.4;
            margin-bottom: 4pt;
          }
          a {
            color: #000000;
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="WordSection1">
          <div class="title-block">
            <div class="paper-title">${docTitle}</div>
            <div class="paper-author">${docAuthor}</div>
            <div class="paper-institution">${docInstitution}</div>
            <div class="paper-meta">Citation Format: ${docCitationStyle} &nbsp;|&nbsp; Date: ${docDate}</div>
            <hr class="title-divider" />
          </div>
          ${rawArticleHtml}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", wordXml], { type: "application/msword;charset=utf-8" });
    const cleanFilename = `Research_Paper_${(topic || "Review").replace(/[^a-zA-Z0-9_-]/g, "_")}.doc`;
    const downloadLink = document.createElement("a");
    document.body.appendChild(downloadLink);
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = cleanFilename;
    downloadLink.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(downloadLink);
  };

  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      
      {/* ---------------- TOP NAVBAR ---------------- */}
      <header className="h-16 shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] flex items-center justify-between px-3 sm:px-6 z-40 transition-colors duration-200 shadow-sm relative">
        
        {/* Logo Area */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 pr-1 lg:pr-4">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-md ring-2 ring-blue-600/20 bg-black flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="LitReviewer AI Logo" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight leading-tight text-gray-900 dark:text-white">LitReviewer AI</h1>
            <span className="text-[10px] text-blue-600 dark:text-cyan-400 font-bold tracking-wide uppercase hidden sm:inline">Autonomous Research Agent</span>
          </div>
        </div>

        {/* Form Inputs (Author, Institution, Topic, Citation, Generate) - Desktop Only (>= lg) */}
        <form onSubmit={handleSubmit} className="hidden lg:flex flex-1 items-end justify-center gap-2 xl:gap-3 min-w-0 mx-2 pb-2.5">
          
          <div className="flex flex-col w-32 xl:w-36 shrink-0 relative group">
            <label className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-1 ml-1 tracking-wider transition-colors group-focus-within:text-blue-600">Author Name</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name..."
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-400 text-gray-900 dark:text-gray-100"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col w-36 xl:w-40 shrink-0 relative group">
            <label className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-1 ml-1 tracking-wider transition-colors group-focus-within:text-blue-600">Institution</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Your institution..."
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-400 text-gray-900 dark:text-gray-100"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col flex-1 min-w-[140px] relative group">
            <label className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-1 ml-1 tracking-wider transition-colors group-focus-within:text-blue-600">Research Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter research topic..."
              className="w-full h-8 px-2.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-400 text-gray-900 dark:text-gray-100 font-medium"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col w-24 xl:w-28 shrink-0 relative group">
            <label className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-1 ml-1 tracking-wider transition-colors group-focus-within:text-blue-600">Citation Style</label>
            <select
              value={citationStyle}
              onChange={(e) => setCitationStyle(e.target.value)}
              className={`w-full h-8 px-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm appearance-none cursor-pointer ${!citationStyle ? 'text-slate-400 dark:text-slate-400' : 'text-gray-900 dark:text-gray-100 font-medium'}`}
              disabled={loading}
            >
              <option value="" disabled hidden>Select style...</option>
              <option value="APA">APA</option>
              <option value="IEEE">IEEE</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !topic.trim() || !author.trim() || !citationStyle}
            className="h-8 bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Generate</span>
          </button>
        </form>

        {/* Mobile Topic Setup Button (< lg) */}
        <button
          type="button"
          onClick={() => setShowMobileSetup(true)}
          className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border border-blue-200/80 dark:border-blue-800/60 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all truncate max-w-[130px] xs:max-w-[170px] sm:max-w-[220px] active:scale-95 cursor-pointer shadow-xs"
          title="Configure Research Topic"
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span className="truncate">{topic.trim() ? topic : "New Research..."}</span>
        </button>

        {/* Right Tools */}
        <div className="flex items-center lg:items-end justify-end gap-1 sm:gap-1.5 shrink-0 pl-1 lg:pl-4 pb-0 lg:pb-2.5">
          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 dark:hover:text-blue-400 transition-all border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-center cursor-pointer shrink-0"
              title="Toggle Theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          )}
          
          {/* History: Compact Square Button with subtle count indicator */}
          {user && (
            <button 
              onClick={() => {
                fetchUserHistory(user.id);
                setShowHistory(!showHistory);
              }}
              className="relative h-8 w-8 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 dark:hover:text-blue-400 bg-white dark:bg-gray-900 transition-all border border-gray-200/80 dark:border-gray-700/80 shadow-xs cursor-pointer active:scale-95 shrink-0"
              title={`Research History (${history.length} saved)`}
            >
              <History className="w-4 h-4 text-blue-500 dark:text-cyan-400" />
              {history.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs">
                  {history.length}
                </span>
              )}
            </button>
          )}

          {/* Credits: Compact Square Button (Lightning Zap + Credit Number, No 'Buy' text) */}
          {user && (
            <button
              type="button"
              onClick={() => setShowCreditModal(true)}
              className="h-8 px-2.5 rounded-lg flex items-center justify-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:border-amber-400 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0 group"
              title="Scholar Credits (Click to top up)"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">{credits}</span>
            </button>
          )}

          {/* User Auth Profile / Sign In */}
          {user ? (
            <div className="relative shrink-0" ref={userDropdownRef}>
              <button 
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="h-8 flex items-center gap-1.5 py-1 pl-1 pr-2 rounded-full bg-slate-50 dark:bg-gray-800/80 hover:bg-slate-100 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-xs group cursor-pointer"
                title={user.email || "Account"}
              >
                {user.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt={user.user_metadata?.full_name || "User"}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-blue-500/40"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {(user.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 max-w-[90px] truncate hidden sm:inline">
                  {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
                  <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800/80 pb-3">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {user.user_metadata?.full_name || 'Academic Scholar'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {user.email}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/40">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {credits} {credits === 1 ? 'Credit' : 'Credits'} Available
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowCreditModal(true);
                      }}
                      className="w-full mt-2.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>⚡ Top Up Credits</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full mt-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/80 px-3 py-1.5 rounded-lg border border-gray-200/90 dark:border-gray-700 shadow-sm hover:shadow transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              title="Sign in with Google"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.37 7.36 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.24C.45 8.14 0 9.99 0 12s.45 3.86 1.24 5.42l4.04-3.13z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.63 1.24 6.58l4.04 3.13c.95-2.83 3.6-4.96 6.72-4.96z" />
              </svg>
              <span>Sign in</span>
            </button>
          )}
        </div>
      </header>

      {/* ---------------- MOBILE VIEW SWITCHER (< lg) ---------------- */}
      <div className="lg:hidden flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] px-3 py-1.5 gap-1.5 shrink-0 z-30">
        <button
          type="button"
          onClick={() => setMobileTab("tracker")}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === "tracker"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 hover:text-gray-900"
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          <span>Agent Progress</span>
          {loading && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("paper")}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === "paper"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 hover:text-gray-900"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Research Paper</span>
          {review && <span className="text-[10px] text-emerald-300">✓</span>}
        </button>
      </div>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar (Multi-Agent Tracker) */}
        <aside className={`${mobileTab === "tracker" ? "flex" : "hidden"} lg:flex w-full lg:w-[340px] shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] overflow-y-auto p-4 sm:p-5 transition-colors duration-200 flex-col gap-6`}>
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase flex items-center justify-between mb-2">
            Multi-Agent Tracker
            {loading && <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold">LIVE</span>}
          </h2>
          
          <div className="relative pl-3">
            {/* Vertical Line */}
            <div className="absolute left-6 top-4 bottom-4 w-px bg-gray-200 dark:bg-gray-800" />
            
            {/* Step 1: Research Crawler */}
            <div className="relative mb-6">
              <div className="flex items-start gap-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold transition-all duration-500 ${currentAgent === "Research Crawler" ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40 animate-pulse' : (fetchedPapers.length > 0 ? 'bg-emerald-500 text-white shadow-sm' : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50')}`}>
                  1
                </div>
                <div className="flex-1 pt-1">
                  <div 
                    className="flex items-center justify-between mb-1 cursor-pointer group"
                    onClick={() => setExpandedStep(expandedStep === 1 ? null : 1)}
                  >
                    <h3 className={`font-semibold text-sm group-hover:text-blue-600 transition-colors ${currentAgent === "Research Crawler" ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>Fetching Literature</h3>
                    <div className="flex items-center gap-2">
                      {currentAgent === "Research Crawler" && <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/50 uppercase animate-pulse">Live</span>}
                      <ChevronDown className={`w-4 h-4 text-blue-500/70 dark:text-blue-400/70 transition-transform duration-300 ${expandedStep === 1 ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600/90 dark:text-blue-400/90 flex items-center gap-1.5 font-medium mb-3">
                    <Sparkles className="w-3 h-3 text-blue-500" /> Agent: Research Crawler
                  </p>
                  
                  <div className={`grid transition-all duration-300 ease-in-out ${expandedStep === 1 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      {currentAgent === "Research Crawler" && (
                        <div className="mb-4">
                          <div className="h-1.5 w-full bg-blue-100/50 dark:bg-blue-950/60 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full animate-pulse w-full"></div>
                          </div>
                          <p className="text-[10px] text-blue-600 dark:text-blue-300 mt-2 font-medium animate-pulse">{agentMessage}</p>
                        </div>
                      )}

                      {fetchedPapers.length > 0 ? (
                        <div className="bg-slate-50 dark:bg-[#161616] rounded-xl border border-slate-200/80 dark:border-gray-800 p-3 mb-2">
                          <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-gray-800 pb-2">
                            <h4 className="text-[10px] font-bold text-slate-600 dark:text-gray-400 tracking-wider uppercase">Papers Found</h4>
                            <span className="text-xs font-bold text-blue-700 dark:text-white bg-white dark:bg-gray-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-gray-700 shadow-sm">{fetchedPapers.length}</span>
                          </div>
                          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {fetchedPapers.map((p, idx) => (
                              <div key={idx} className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-slate-200/70 dark:border-gray-700 shadow-sm hover:border-blue-400 transition-colors cursor-default">
                                <h5 className="text-[11px] font-semibold text-slate-800 dark:text-gray-200 line-clamp-2 leading-tight">{p.title}</h5>
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1.5 tracking-wide">{p.source.toUpperCase()} <span className="text-slate-400 dark:text-gray-400 font-normal ml-1">• {p.year}</span></p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        !currentAgent && <div className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-md border border-blue-200/60 dark:border-blue-900/40 font-medium inline-block mb-2">Standby • Ready to search ArXiv</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Data Engineer */}
            <div className="relative mb-6">
              <div className="flex items-start gap-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold transition-all duration-500 ${currentAgent === "Data Engineer" ? 'bg-purple-600 text-white ring-4 ring-purple-100 dark:ring-purple-900/40 animate-pulse' : (currentAgent === "Content Writer" || review ? 'bg-emerald-500 text-white shadow-sm' : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50')}`}>
                  2
                </div>
                <div className="flex-1 pt-1">
                  <div 
                    className="flex items-center justify-between mb-1 cursor-pointer group"
                    onClick={() => setExpandedStep(expandedStep === 2 ? null : 2)}
                  >
                    <h3 className={`font-semibold text-sm group-hover:text-purple-600 transition-colors ${currentAgent === "Data Engineer" ? 'text-purple-600 dark:text-purple-400' : 'text-slate-800 dark:text-slate-200'}`}>Vectorizing in Qdrant</h3>
                    <div className="flex items-center gap-2">
                      {currentAgent === "Data Engineer" ? (
                        <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/50 uppercase animate-pulse">Live</span>
                      ) : (
                        (!review && currentAgent !== "Content Writer" && fetchedPapers.length === 0 && <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/50 uppercase">Queued</span>)
                      )}
                      <ChevronDown className={`w-4 h-4 text-purple-500/70 dark:text-purple-400/70 transition-transform duration-300 ${expandedStep === 2 ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  <p className="text-xs text-purple-600/90 dark:text-purple-400/90 flex items-center gap-1.5 font-medium mb-3">
                    <Sparkles className="w-3 h-3 text-purple-500" /> Agent: Data Engineer
                  </p>
                  
                  <div className={`grid transition-all duration-300 ease-in-out ${expandedStep === 2 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      {currentAgent === "Data Engineer" || currentAgent === "Content Writer" || review ? (
                        <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30 p-3 mb-2">
                           <div className="flex items-center gap-3 mb-2">
                             <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <BrainCircuit className="w-4 h-4" />
                             </div>
                             <div>
                               <h4 className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Embeddings Model</h4>
                               <p className="text-[10px] text-gray-500">BAAI/bge-small-en-v1.5</p>
                             </div>
                           </div>
                           <div className="mt-3 bg-white dark:bg-[#161616] p-2 rounded-lg border border-purple-100 dark:border-purple-900/20 shadow-sm flex items-center justify-between">
                             <span className="text-[10px] font-semibold text-gray-500">Target Vectors:</span>
                             <span className="text-xs font-bold text-purple-600">{fetchedPapers.length > 0 ? fetchedPapers.length : '-'} Chunks</span>
                           </div>
                           {currentAgent === "Data Engineer" && <p className="text-[10px] text-purple-600 dark:text-purple-300 mt-3 font-medium text-center animate-pulse">{agentMessage}</p>}
                        </div>
                      ) : (
                        <div className="text-[11px] text-purple-700 dark:text-purple-300 bg-purple-50/80 dark:bg-purple-950/40 px-2.5 py-1.5 rounded-md border border-purple-200/60 dark:border-purple-900/40 font-medium inline-block mb-2">Standby • Awaiting paper crawler</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Content Writer */}
            <div className="relative">
              <div className="flex items-start gap-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold transition-all duration-500 ${currentAgent === "Content Writer" && loading ? 'bg-amber-500 text-white ring-4 ring-amber-100 dark:ring-amber-900/40 animate-pulse' : (review && !loading ? 'bg-emerald-500 text-white shadow-sm' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50')}`}>
                  3
                </div>
                <div className="flex-1 pt-1">
                  <div 
                    className="flex items-center justify-between mb-1 cursor-pointer group"
                    onClick={() => setExpandedStep(expandedStep === 3 ? null : 3)}
                  >
                    <h3 className={`font-semibold text-sm group-hover:text-amber-600 transition-colors ${(currentAgent === "Content Writer" || review) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>Sequential Drafting</h3>
                    <div className="flex items-center gap-2">
                      {currentAgent === "Content Writer" && loading ? (
                        <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/50 uppercase animate-pulse">Live</span>
                      ) : (
                        (!review && <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/50 uppercase">Waiting</span>)
                      )}
                      <ChevronDown className={`w-4 h-4 text-amber-500/70 dark:text-amber-400/70 transition-transform duration-300 ${expandedStep === 3 ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  <p className="text-xs text-amber-600/90 dark:text-amber-400/90 flex items-center gap-1.5 font-medium mb-3">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Agent: Content Writer
                  </p>

                  <div className={`grid transition-all duration-300 ease-in-out ${expandedStep === 3 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      {currentAgent === "Content Writer" || review ? (
                         <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 p-3 mb-2">
                           <div className="flex flex-col gap-2">
                             <div className="flex items-center justify-between bg-white dark:bg-[#161616] p-2 rounded-lg border border-amber-100 dark:border-amber-900/20 shadow-sm">
                               <div className="flex items-center gap-2">
                                 <div className={`w-2 h-2 rounded-full ${currentAgent === "Content Writer" && loading ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`} />
                                 <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">Retrieval Augmented Gen.</span>
                               </div>
                               <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-1.5 py-0.5 rounded uppercase">Active</span>
                             </div>
                             <div className="flex items-center justify-between bg-white dark:bg-[#161616] p-2 rounded-lg border border-amber-100 dark:border-amber-900/20 shadow-sm">
                               <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-blue-500" />
                                 <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">Citation Enforcer</span>
                               </div>
                               <span className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase">{citationStyle || "IEEE"}</span>
                             </div>
                           </div>
                           {currentAgent === "Content Writer" && loading && <p className="text-[10px] text-amber-600 dark:text-amber-300 mt-3 font-medium text-center animate-pulse">{agentMessage || "Drafting paragraphs..."}</p>}
                         </div>
                      ) : (
                         <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-md border border-amber-200/60 dark:border-amber-900/40 font-medium inline-block mb-2">Standby • Awaiting Qdrant vectors</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </aside>

        {/* Right Main (Document Editor) */}
        <main className={`${mobileTab === "paper" ? "flex" : "hidden"} lg:flex flex-1 flex-col bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200 relative overflow-hidden`}>
          
          {/* History Overlay */}
          {showHistory && (
            <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-sm z-30 p-4 sm:p-8 flex items-center justify-center overflow-y-auto">
              <div className="w-full max-w-2xl bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-[#1a1d26]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-cyan-400">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">Past Research Papers</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Saved securely in your cloud account ({history.length} {history.length === 1 ? 'paper' : 'papers'})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {history.length > 0 && (
                      <button
                        onClick={clearAllCloudHistory}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Clear all saved papers"
                      >
                        Clear All
                      </button>
                    )}
                    <button
                      onClick={() => setShowHistory(false)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Paper List */}
                <div className="p-6 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-500 dark:text-cyan-400 flex items-center justify-center mb-3">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">No Saved Papers Yet</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Your generated literature reviews will automatically be saved here in your cloud account so you never lose them.
                      </p>
                    </div>
                  ) : (
                    history.map((item) => (
                      <div
                        key={item.id || item.topic}
                        onClick={() => loadHistoryItem(item)}
                        className="group relative p-4 border border-gray-200 dark:border-gray-800/90 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-[#1a1d26] rounded-xl hover:shadow-md cursor-pointer transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                              {item.topic}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {item.mode && (
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  item.mode === 'preview'
                                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-900/50'
                                }`}>
                                  {item.mode === 'preview' ? '⚡ Preview' : '🎓 Full Paper'}
                                </span>
                              )}
                              {item.citation_style && (
                                <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-cyan-400 font-bold text-[10px]">
                                  {item.citation_style}
                                </span>
                              )}
                              <span>By {item.author || "LitReviewer AI"}{item.institution ? ` • ${item.institution}` : ""}</span>
                              {(item.created_at || item.timestamp) && (
                                <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  {formatTimestamp(item.created_at || item.timestamp)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => deleteFromCloudHistory(item.id, e)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors shrink-0"
                            title="Delete paper"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Editor Header / Toolbar */}
          <div className="h-14 shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] flex items-center justify-between px-3 sm:px-6 z-10">
            <div className="flex items-center gap-2 sm:gap-4 truncate">
              <span className="text-[10px] sm:text-xs font-bold tracking-widest text-gray-800 dark:text-gray-200 uppercase truncate max-w-[150px] sm:max-w-none">
                LITERATURE REVIEW PAPER
              </span>
              {loading && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium whitespace-nowrap">
                  <RefreshCw className="w-3 h-3 animate-spin" /> <span className="hidden xs:inline">AUTOSAVING...</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3" ref={exportDropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors ring-1 ring-blue-200 dark:ring-blue-900 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> <span>Export</span> <ChevronDown className={`w-3 h-3 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showExportDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleDownloadWord();
                      }}
                      className="w-full text-left px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <span className="text-blue-600 font-bold">W</span> Microsoft Word (.doc)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportDropdown(false);
                        handlePrint();
                      }}
                      className="w-full text-left px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <span className="text-red-600 font-bold">P</span> Adobe PDF (.pdf)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Editor Paper Surface (SCROLLING AREA) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar relative p-3 sm:p-6 lg:p-12 pb-24 flex justify-center w-full scroll-smooth">
             <div ref={componentRef} className="w-full max-w-[850px] bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm min-h-[calc(100vh-12rem)] p-4 sm:p-8 lg:p-16 relative flex flex-col">
               
               {/* Decorative Edge Line representing AI streaming */}
               {loading && currentAgent === "Content Writer" && (
                 <div className="no-print absolute top-0 right-0 bottom-0 w-1 rounded-r-lg bg-gradient-to-b from-transparent via-blue-500 to-purple-500 opacity-50 animate-pulse" />
               )}

               {error && (
                 <div className="no-print bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm font-medium border border-red-200 dark:border-red-800/50 mb-6 shrink-0">
                   Error: {error}
                 </div>
               )}
              {!review && !loading && !error && (
                <div className="no-print flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 space-y-4 py-12 text-center">
                  <BookOpen className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">Your research paper will appear here.</p>
                  <button
                    type="button"
                    onClick={() => setShowMobileSetup(true)}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Start Research Paper</span>
                  </button>
                </div>
              )}

              {/* Better loading state for any agent before text streams */}
              {!review && loading && (
                <div className="no-print flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 space-y-6 max-w-sm mx-auto text-center">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-blue-100 dark:border-blue-900/30 rounded-full" />
                    <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
                    <BrainCircuit className="w-6 h-6 text-blue-600 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {generationMode === "preview" ? "Analyzing 5 Papers (Preview Blueprint)..." : "Analyzing 20 Papers (Comprehensive Review)..."}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {generationMode === "preview"
                        ? "The AI is vectorizing 5 papers for your Academic Blueprint preview. (Full 20-paper synthesis requires Login)"
                        : "The AI is vectorizing and cross-referencing all 20 papers for your 6,000+ word review."}
                    </p>
                    <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-full text-xs font-bold shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                      {agentMessage || "Processing..."}
                    </div>
                  </div>
                </div>
              )}

              {review && (
                <article className="prose dark:prose-invert max-w-none academic-paper text-justify prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-800 dark:prose-p:text-gray-300 prose-a:text-blue-600 dark:prose-a:text-blue-400 pb-10">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-3xl mt-8 mb-6 pb-2 border-b border-gray-200 dark:border-gray-800 text-center font-bold text-gray-900 dark:text-white" {...props} />,
                      h2: ({node, ...props}) => {
                        const headingText = String(props.children || "");
                        const isRef = headingText.toLowerCase().includes("reference") || headingText.toLowerCase().includes("bibliography") || headingText.toLowerCase().includes("works cited");
                        return (
                          <h2
                            className={`text-2xl mt-10 mb-4 text-gray-900 dark:text-white font-bold border-b border-gray-200 dark:border-gray-800 pb-2 ${isRef ? 'print-page-break' : ''}`}
                            {...props}
                          />
                        );
                      },
                      h3: ({node, ...props}) => <h3 className="text-xl mt-8 mb-3 font-bold text-gray-900 dark:text-white" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-700 dark:text-gray-300 my-6 bg-gray-50/80 dark:bg-gray-800/40 py-3 pr-4 rounded-r-lg" {...props} />,
                    }}
                  >
                    {review}
                  </ReactMarkdown>
                  
                  {loading && currentAgent === "Content Writer" && (
                    <div className="no-print mt-4 flex items-center gap-2 text-blue-500 text-sm font-medium animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> AI is typing...
                    </div>
                  )}
                </article>
              )}

              {/* Full Review Locked Banner */}
              {lastGeneratedMode === "preview" && review && !loading && (
                <div className="no-print mt-8 p-6 rounded-2xl bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/60 dark:from-[#15171e] dark:via-blue-950/20 dark:to-indigo-950/20 border border-blue-200/90 dark:border-blue-800/80 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-5 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-600 text-white shadow-md shrink-0 mt-0.5">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">Full Academic Manuscript Locked</h4>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold text-[10px]">
                          5 of 20 Papers Analyzed
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed max-w-xl">
                        This free preview synthesized 5 foundational papers. To analyze all <strong>20 papers</strong> and generate the comprehensive <strong>6,000+ word manuscript</strong> with complete IEEE citations and Word/PDF export, <strong>Login is required</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        sessionStorage.setItem("litreviewer_pending_full_gen", "true");
                        setShowAuthModal(true);
                      } else if (credits <= 0) {
                        setShowCreditModal(true);
                      } else {
                        triggerGeneration("full");
                      }
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" /> Unlock Full 6,000+ Word Review
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Status Bar (FIXED AT BOTTOM) */}
          <div className="h-10 shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] flex items-center justify-between px-3 sm:px-6 z-20 text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider">
            <div className="flex items-center gap-2 sm:gap-4 truncate">
              {loading && currentAgent === "Content Writer" ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-16 sm:w-24 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 w-full animate-pulse" />
                  </div>
                  <span className="animate-pulse text-blue-600 dark:text-blue-400 truncate">AI IS WRITING...</span>
                </div>
              ) : (
                <span className={`truncate ${review ? "text-green-600 dark:text-green-500" : ""}`}>{review ? "✓ GENERATION COMPLETE" : "READY"}</span>
              )}
            </div>
            <div className="flex items-center gap-3 sm:gap-8 shrink-0">
              <span>WORDS: {review.split(/\s+/).filter(w => w.length > 0).length.toLocaleString()}</span>
              <span className="hidden md:inline">CHARACTERS: {review.length.toLocaleString()}</span>
              <span>PAGES: {Math.max(1, Math.ceil(review.split(/\s+/).filter(w => w.length > 0).length / 350))}</span>
            </div>
          </div>
        </main>
      </div>

      {/* Research Configuration Modal (Laptop & Mobile) */}
      {showMobileSetup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 p-4 flex items-center justify-center animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-5 sm:p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Start Research Review</h2>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Configure parameters for AI synthesis</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileSetup(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowMobileSetup(false);
                handleSubmit(e);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Research Topic <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Impact of Artificial Intelligence in Healthcare..."
                  className="w-full p-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 resize-none font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Author Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Your name..."
                    className="w-full h-9 px-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Institution
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="University..."
                    className="w-full h-9 px-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Citation Style <span className="text-rose-500">*</span>
                </label>
                <select
                  value={citationStyle}
                  onChange={(e) => setCitationStyle(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 cursor-pointer"
                  required
                >
                  <option value="" disabled hidden>Select citation format...</option>
                  <option value="APA">APA Style (Author-Date)</option>
                  <option value="IEEE">IEEE Style (Numbered Bracket)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !topic.trim() || !author.trim() || !citationStyle}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                  <span>Generate Literature Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guest Limit Modal */}
      {showGuestLimitModal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-sm z-50 p-4 flex items-center justify-center animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#15171e] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowGuestLimitModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-cyan-400 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Free Guest Limit Reached
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              You have completed your free preview generations. Sign in with Google (1-click, takes 2 seconds) to continue generating and unlock full 6,000+ word academic reviews.
            </p>

            <button
              onClick={() => {
                setShowGuestLimitModal(false);
                setShowAuthModal(true);
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" /> Sign in with Google (1-Click)
            </button>
          </div>
        </div>
      )}

      {/* 1-Click Google Auth Gate Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onGoogleSignIn={handleSignInWithGoogle}
      />

      {/* Scholar Credits Top-Up Modal */}
      <CreditModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        currentCredits={credits}
        onTopUp={handleTopUpCredits}
        userId={user?.id}
        userEmail={user?.email || ""}
        onRequireAuth={() => setShowAuthModal(true)}
      />
    </div>
  );
}
