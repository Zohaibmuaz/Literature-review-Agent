# LitReviewer AI - Master Task Roadmap & Progress Tracker

Track our step-by-step implementation. We execute and verify **one task at a time**, ticking each box upon completion.

---

## 🚀 Progress Overview

- [x] **Phase 1: Client-Side Isolated History (LocalStorage)** *(Completed & Verified)*
- [x] **Phase 2: Value-First Dual Generation (Free Preview vs Full Paper)** *(Completed & Verified)*
- [x] **Phase 3: 1-Click Google Authentication (Supabase Setup)** *(Completed & Verified)*
- [x] **Phase 4: Cloud Database & Credit System (PostgreSQL Sync)** *(Completed & Verified)*
- [x] **Phase 5: DOCX/PDF Export & Credit Pack Modal** *(Completed & Verified)*
- [x] **Phase 6: Safepay Payment Gateway Integration** *(Completed & Verified)*

---

## Detailed Task Breakdown

### 📦 Phase 1: Client-Side Isolated History (LocalStorage)
*Fix history immediately on browser-level with zero third-party dependency, zero cost, and zero data leaks.*
- [x] **1.1 LocalStorage Manager**: Create local storage helper functions (`saveToHistory`, `getHistory`, `deleteHistoryItem`, `clearAllHistory`) in `frontend`.
- [x] **1.2 History Metadata**: Save paper topic, author, institution, citation style, timestamp, preview snippet, and full content.
- [x] **1.3 UI Drawer Update**:
  - [x] Display list of saved papers with clickable cards to load into the viewer.
  - [x] Show relative timestamps (e.g. "Just now", "2 hours ago", date).
  - [x] Add individual delete (trash icon) and clear history controls.
  - [x] Dynamic counter badge in navbar: `History (X)`.
- [x] **1.4 Backend Cleanup**: Bound memory on backend `paper_history` list so memory is not leaked.
- [x] **1.5 Verification**: Verified with `npm run build` (compiled clean in 4.7s, zero errors).

---

### 📦 Phase 2: Value-First Dual Generation (Free Preview vs Full Paper)
*Hook users with instant free value without login barrier, reserving heavy generation for authenticated users.*
- [x] **2.1 Backend Dual Mode & Robust Retrieval**:
  - [x] Mode `preview`: Fast generation of Abstract + Research Themes + Top 5 ArXiv Papers (< 20s, < $0.0005 cost).
  - [x] Mode `full`: Complete 3,000-word, 5-section academic review with 20 IEEE citations.
  - [x] ArXiv HTTPS & Retry Hardening: Switched to `https://export.arxiv.org`, custom academic User-Agent, and 3-attempt fallback to eliminate `getaddrinfo failed` DNS issues.
- [x] **2.2 Clean Automated UX (No Clutter / No Mode Buttons in Navbar)**:
  - [x] Preserved single clean "Generate" button in navbar.
  - [x] Automatically generates the free preview blueprint for guest users.
  - [x] Bottom Locked Banner: *"Full Literature Review Locked (Preview Completed) — Full 9-page generation ke liye Login zaroori hai"* with 1-click Unlock button.
- [x] **2.3 User Experience Flow**: Seamless transition from preview to full generation without losing entered topic, author, or institution.

---

### 📦 Phase 3: 1-Click Google Authentication (Supabase Setup)
*Zero-friction 1-click Google OAuth with zero passwords and zero email verification codes.*
- [x] **3.1 Supabase Project Setup**: Connect Next.js frontend with `@supabase/supabase-js`, `.env.local`, and client helper `src/lib/supabase.ts`.
- [x] **3.2 Google OAuth Provider**: Enable Google Sign-In with 1-click redirect and auto-callback handler.
- [x] **3.3 Navbar User Profile**:
  - [x] "Sign in" button with Google icon when logged out.
  - [x] Avatar image, user name, credit badge (`Scholar Pass Active`), and "Sign Out" dropdown when logged in.
- [x] **3.4 Auth Gate Modal**: Smooth modal that appears when a guest user clicks "Unlock Full 6,000+ Word Review" or reaches the guest limit.
- [x] **3.5 Seamless Auto-Resume**: Pending full generation triggers automatically upon successful Google OAuth redirect.

---

### 📦 Phase 4: Cloud Database & Credit System (PostgreSQL)
*Store user papers permanently in the cloud and prevent unlimited token abuse with fair credits.*
- [x] **4.1 Supabase Schema**:
  - [x] `profiles` table: `id`, `email`, `credits_balance` (defaults to 3 free papers on registration).
  - [x] `papers` table: `id`, `user_id`, `topic`, `citation_style`, `review`, `created_at` with RLS.
- [x] **4.2 User-Isolated Cloud Sync**:
  - [x] User A and User B have 100% strictly isolated history via Row Level Security.
  - [x] History button is hidden for unauthenticated guests, visible only to logged-in users.
- [x] **4.3 Credit Tracking & Cloud Actions**:
  - [x] Real-time credits balance displayed in user profile dropdown.
  - [x] Individual cloud delete and clear all synced with PostgreSQL.

---

### 📦 Phase 5: DOCX/PDF Export & Credit Pack Modal
*High-value exports and easy pay-as-you-go credit packs.*
- [x] **5.1 DOCX Academic Formatter**:
  - [x] Journal-grade Title Block: 18pt bold centered title, 12pt author, 11pt italic institution, citation style & date, separated by dividing rule.
  - [x] 1.0-inch page margins (`@page WordSection1 { margin: 1.0in; }`), 1.5 line spacing, Times New Roman 12pt.
  - [x] Solid black headings (no blue/dark web classes leaked).
  - [x] Hard section page break before References (`mso-break-type: section-break`).
- [x] **5.2 Publication-Grade PDF Print Stylesheet**:
  - [x] Print `@media print` with 1.0in margins, pure black on white background, hidden web UI chrome (`no-print`).
  - [x] Forced page break on References (`break-before: page;`).
  - [x] Heading orphan prevention (`break-after: avoid; page-break-inside: avoid;`).
- [x] **5.3 Credit Pack Modal & Top-Up Flow**:
  - [x] 3 User-vetted Tiers: Starter Pack (3 Papers - $4.99), Researcher Pack (8 Papers - $9.99 - Most Popular), Scholar Pro (20 Papers - $19.99 - $1/paper).
  - [x] Direct top-up integration updating Supabase `profiles.credits_balance` and local credit state.
  - [x] Credit balance badge and "Top Up Credits" button in navbar and profile dropdown.
  - [x] Full generation gated when credits = 0, automatically prompting the credit pack modal.
- [x] **5.4 Verification**: `npm run build` compiled clean with 0 errors (Exit code 0).

---

### 📦 Phase 6: Safepay Payment Gateway Integration (Testing & Production)
*Automated Pakistani & Global Monetization via Cards, JazzCash & EasyPaisa with Zero Minimum Payout Barriers.*
- [x] **6.1 Credentials & Environment Setup**: Extracted Sandbox Public Key & Secret Key configured in `frontend/.env.local`.
- [x] **6.2 Order Initialization Route (`/api/payment/create-checkout`)**: Server-side API communicates with Safepay API (`/order/v1/init`) to generate hosted checkout tokens.
- [x] **6.3 Payment Verification Route (`/api/payment/verify`)**: Validates transaction state directly with Safepay API and atomically increments credits in Supabase `profiles`.
- [x] **6.4 Asynchronous Webhook Route (`/api/webhooks/safepay`)**: Server-to-server webhook endpoint verifying HMAC-SHA256 signatures for production reliability.
- [x] **6.5 Results & Celebration Pages**:
  - [x] `/payment/success`: Celebratory confirmation, tracker validation, real-time balance refresh, and return-to-editor button.
  - [x] `/payment/cancel`: Friendly retry and return flow.
- [x] **6.6 CreditModal Integration**: Connected pack selection buttons to launch Safepay hosted checkout with dual USD/PKR pricing.
- [x] **6.7 Build Verification**: Compiled clean with Next.js 16 Turbopack (Exit Code 0).
