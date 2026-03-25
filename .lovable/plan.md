

## Plan: Expand Developer Portal for All Partner Types

### Problem
The Developer Portal only covers merchant integration (payment sessions, SDK). It doesn't address how **banks**, **card networks**, **other MFS providers**, or **utility billers** can connect with EasyPay as partners.

### Solution
Add a **"Partnership Programs"** section above Quick Start with cards for each partner type, and a dedicated **"Partner Integration Guides"** section with collapsible details for each category.

### Changes to `src/pages/DeveloperPortal.tsx`

**1. Update Hero subtitle** to mention all partner types, not just payments.

**2. Add nav links** — "Partners" anchor in header nav.

**3. New "Partnership Programs" section** (after Integration Methods) — 4 cards:

| Partner Type | Description |
|---|---|
| **Banks & Financial Institutions** | Link bank accounts for fund transfers, settlements, and wallet top-ups via our Banking API |
| **Card Networks** | Connect Visa, Mastercard, or local card rails for card-linked wallet funding and payments |
| **MFS Providers** | Interoperability with bKash, Nagad, Rocket, etc. for cross-platform transfers |
| **Utility Billers** | Register as a biller to receive payments through EasyPay's bill pay network |

**4. New "Partner Integration Guides" section** — collapsible blocks for each type with:
- **Banking API**: endpoints for bank verification, fund transfer initiation, settlement webhooks, required credentials
- **Card Integration**: card tokenization flow, 3DS callbacks, settlement cycle docs
- **MFS Interoperability**: cross-wallet transfer API, reconciliation endpoints, sandbox testing
- **Biller Onboarding**: biller registration, payment notification webhooks, config params

**5. Update CTA** — change from "Become a Merchant" only to include "Partner with Us" option.

### File
- `src/pages/DeveloperPortal.tsx` — sole file modified

