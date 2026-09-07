# LitReviewer AI - Safepay Integration Plan (Testing & Production)

## 1. Goal Description
Transform LitReviewer AI's credit packs from simulated top-ups into a fully functional, automated payment gateway powered by **Safepay** (State Bank of Pakistan regulated, Y-Combinator W22 backed).

This document outlines the complete roadmap for:
1. **Testing Environment (Sandbox)**: Testing mock Visa/Mastercard and JazzCash/EasyPaisa payments with the extracted developer keys without risking real money.
2. **Production Environment (Live)**: Seamlessly flipping the switch to live production with direct payouts to your Pakistani bank account.

---

## 2. User Review Required & Design Decisions

### Extracted Sandbox Credentials:
- **Public Key**: `sec_bc4df42f-9a8e-465f-aef5-e4f5c58f80c9`
- **Secret Key**: `e6a3af69fb21658e60f8243ba0fc511061b13538fb27d8c79b1b8cfb9696da7d`
- **Environment**: Sandbox (`https://sandbox.api.getsafepay.com`)

### Pricing & Currency Mapping (USD to PKR)
Safepay processes transactions natively in PKR. We map our 3 credit tiers to realistic PKR amounts:
- **Starter Pack (3 Papers)**: $4.99 -> **Rs. 1,400 PKR** (~$1.66 / paper)
- **Researcher Pack (8 Papers - Most Popular)**: $9.99 -> **Rs. 2,800 PKR** (~$1.24 / paper)
- **Scholar Pro (20 Papers - Best Value)**: $19.99 -> **Rs. 5,600 PKR** (~$1.00 / paper)

In the UI, both USD and PKR will be shown cleanly (e.g. `$4.99 (Rs. 1,400)`) so Pakistani and international users both feel at home.

---

## 3. Architecture & Verification Flow

```
[Scholar User]
      │
      ▼
Clicks "Get 8 Papers ($9.99)" in CreditModal
      │
      ▼
Calls Next.js API: /api/payment/create-checkout
      │
      ▼
Backend initiates order with Safepay API (POST /order/v1/init)
      │
      ▼
Safepay returns order tracker token
      │
      ▼
Frontend opens Safepay Checkout Window (Cards, JazzCash, EasyPaisa)
      │
      ▼
Customer completes payment
      │
      ▼
Safepay redirects to /payment/success?tracker=track_xyz
      │
      ▼
Backend verifies tracker with Safepay API & checks state == "PAID"
      │
      ▼
Supabase DB atomically increments profiles.credits_balance (+8 credits)
      │
      ▼
Success screen displays updated balance & redirects back to research editor!
```

---

## 4. Proposed Code Changes

### A. Environment Configuration (`frontend/.env.local`)
Add Safepay sandbox keys:
```env
# Safepay Payment Gateway (Sandbox)
NEXT_PUBLIC_SAFEPAY_ENV=sandbox
NEXT_PUBLIC_SAFEPAY_PUBLIC_KEY=sec_bc4df42f-9a8e-465f-aef5-e4f5c58f80c9
SAFEPAY_SECRET_KEY=e6a3af69fb21658e60f8243ba0fc511061b13538fb27d8c79b1b8cfb9696da7d
```

---

### B. Next.js Server API Routes

1. **`frontend/src/app/api/payment/create-checkout/route.ts`**:
   - Secure server-side route that creates the order with Safepay using `SAFEPAY_SECRET_KEY`.
   - Sends tier pricing, customer email, and user ID metadata.
   - Generates Safepay hosted checkout redirect URL.

2. **`frontend/src/app/api/payment/verify/route.ts`**:
   - Verifies the tracker token directly with Safepay API (`GET /order/v1/{tracker}`).
   - Idempotency guard: prevents duplicate credit redemption.
   - Updates `profiles.credits_balance` in Supabase PostgreSQL.

3. **`frontend/src/app/api/webhooks/safepay/route.ts`**:
   - Webhook receiver verifying HMAC-SHA256 signature for asynchronous server-to-server notifications.

---

### C. Frontend Checkout & Result Pages

1. **`frontend/src/app/payment/success/page.tsx`**:
   - Displays celebratory payment confirmation.
   - Automatically verifies tracker, updates credits in real-time, and navigates back to editor.

2. **`frontend/src/app/payment/cancel/page.tsx`**:
   - Friendly cancellation page with retry option.

3. **`frontend/src/components/CreditModal.tsx`**:
   - Connects pack buttons to initiate Safepay Checkout.
   - Dual currency display (e.g. `$4.99 • Rs. 1,400`).

---

## 5. Testing Plan (Sandbox Step-by-Step)

1. **Mock Card Payment**:
   - Card: Safepay Test Visa (`4111 1111 1111 1111`, `12/28`, CVV `123`).
   - Verify payment succeeds and Supabase database balance increases by selected credits.
2. **Mock JazzCash / EasyPaisa**:
   - Mobile: `03001234567`.
   - Authorize in Sandbox -> Verify credits added.
3. **Cancel Test**:
   - Close checkout -> Verifies user redirected to cancel page with 0 credits added.
4. **Idempotency Guard**:
   - Refreshing `/payment/success` does not duplicate credits.

---

## 6. How to Switch to Production (Real Money Payouts)

When ready to collect real money:
1. **Safepay Dashboard**: Go to "Production Account" -> Submit CNIC and Pakistani Bank IBAN.
2. **Update `.env.local`**:
   ```env
   NEXT_PUBLIC_SAFEPAY_ENV=production
   NEXT_PUBLIC_SAFEPAY_PUBLIC_KEY=sec_live_...
   SAFEPAY_SECRET_KEY=live_secret_...
   ```
   Zero code changes needed! The codebase automatically routes to production with daily automatic payouts directly into your Pakistani bank account.
