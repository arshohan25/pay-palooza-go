# EasyPay MFS Ecosystem Blueprint
## Internet-Based Mobile Financial Service — Bangladesh Context

---

## 1. Product Overview

### Ecosystem Components

| Component | Description | Status |
|-----------|------------|--------|
| **Customer Wallet** | Digital wallet for P2P, merchant payments, bill pay, recharge | ✅ Built |
| **Agent Network** | Cash-in/cash-out points with commission system | 🔶 Partial (agent cash-out flow exists) |
| **Merchant Payments** | QR-based payment acceptance, settlement | 🔶 Partial (payment flow exists) |
| **Distributor Management** | Float distribution hierarchy | ❌ Not built |
| **Admin Backoffice** | User/txn management, fraud, config | ❌ Not built |
| **Compliance System** | AML/KYC monitoring, reporting | 🔶 Partial (KYC flow UI exists) |

### Fund Flow Architecture

```
Trust Bank Account (Escrow)
        │
        ├── Customer Wallets (pooled ledger)
        ├── Agent Float Wallets
        ├── Merchant Settlement Wallets
        └── Revenue/Fee Collection Account
```

**Key Principle:** Every taka in the system maps 1:1 to funds held in a licensed trust bank account. The platform never holds customer funds — they're held in escrow per Bangladesh Bank MFS regulations.

---

## 2. User Roles & Permissions

### Role Hierarchy

```
Super Admin
├── Compliance Officer (read-only audit + flag authority)
├── Finance Team (settlement, reconciliation)
├── Operations (agent/merchant management)
│
├── Super Distributor
│   └── Distributor
│       └── Agent
│
├── Merchant
│   ├── Enterprise Merchant (API integration)
│   └── Small Merchant (QR-only)
│
└── Customer
    ├── Tier 0 (unverified, ≤10k balance)
    ├── Tier 1 (basic KYC, ≤50k balance)
    └── Tier 2 (full KYC, ≤500k balance)
```

### Permission Matrix

| Action | Customer | Agent | Merchant | Distributor | Admin | Compliance |
|--------|----------|-------|----------|-------------|-------|------------|
| Send Money | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cash In | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cash Out | ✅ (request) | ✅ (execute) | ❌ | ❌ | ❌ | ❌ |
| Accept Payment | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Distribute Float | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| View All Txns | Own only | Own only | Own only | Network only | ✅ | ✅ |
| Freeze Account | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Configure Fees | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Generate Reports | ❌ | ❌ | Own only | Network | ✅ | ✅ |
| Approve KYC | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Flag Suspicious | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 3. Core Features (Detailed)

### Customer App (Current: EasyPay PWA)

**✅ Already Built:**
- Phone+PIN registration & login (phone-as-email pattern)
- Wallet balance display with real-time updates
- Send Money (P2P with atomic `transfer_money` RPC)
- Cash Out via agent (with 0.49% agent commission)
- QR Scan & Pay
- Mobile Recharge (5 operators: GP, Robi, Airtel, BL, Teletalk)
- Bill Payment (Electricity, Gas, Water, Internet)
- Add Money flow
- Transaction History with filters
- Spending Insights (charts)
- Limits & Charges page
- Referral system
- Biometric auth support
- Bengali/English localization
- PWA with offline support
- Pull-to-refresh, skeleton loading
- Notification center + inbox

**🔶 Needs Enhancement:**
- eKYC: UI exists but needs backend verification pipeline
- Bank linking: UI exists but no actual bank API integration
- Merchant payment: Works as P2P, needs dedicated merchant settlement

**❌ To Build:**
- Statement download (PDF)
- Scheduled/recurring payments
- Request money
- Split bill
- Mini savings product
- Insurance micro-products
- Standing instructions

### Agent App

**Core Workflows:**

1. **Customer Onboarding**
   - Scan customer NID → OCR extract → create account
   - Biometric capture → liveness check
   - Agent earns ৳5 per successful onboarding

2. **Cash In (Customer deposits cash)**
   ```
   Customer gives cash → Agent enters amount + customer phone
   → PIN confirmation → Customer wallet credited
   → Agent float debited → Agent earns commission
   ```

3. **Cash Out (Customer withdraws cash)**
   ```
   Customer initiates from app → enters agent number + amount
   → PIN + slide confirm → Agent float credited + commission
   → Customer wallet debited + fee charged
   → Agent gives cash to customer
   ```

4. **Float Management**
   - View current float balance
   - Request float from distributor
   - Float transfer history
   - Low float alerts

5. **Commission Dashboard**
   - Daily/weekly/monthly earnings
   - Breakdown by transaction type
   - Commission withdrawal to bank

### Merchant System

1. **QR Payment Acceptance**
   - Static QR (printed, linked to merchant wallet)
   - Dynamic QR (amount-embedded, generated per transaction)
   - Payment notification (push + sound)

2. **Settlement**
   - T+1 settlement to linked bank account
   - Manual settlement request
   - Settlement history & reconciliation

3. **Refund**
   - Full/partial refund within 72 hours
   - Refund requires merchant PIN
   - Auto-credit to customer wallet

4. **Merchant Dashboard**
   - Daily sales summary
   - Transaction search
   - Monthly statements
   - MDR fee breakdown

### Admin Backoffice

| Module | Features |
|--------|----------|
| **User Management** | Search, view, freeze, tier upgrade, role assignment |
| **Transaction Monitor** | Real-time feed, search, reversal, dispute resolution |
| **Fraud Detection** | Rule engine, velocity checks, anomaly alerts |
| **Fee Configuration** | Dynamic fee/commission tables per txn type/tier |
| **KYC Review** | Pending applications, approve/reject, document viewer |
| **Agent Management** | Onboard, activate/deactivate, territory mapping |
| **Merchant Management** | Onboard, QR generation, settlement config |
| **Reporting** | Daily/monthly MIS, regulatory reports, audit trail |
| **Settlement** | Batch processing, reconciliation, bank file generation |
| **System Config** | Feature flags, maintenance mode, rate limits |

---

## 4. Technical Architecture

### Current Architecture (EasyPay)

```
┌─────────────────────────────────┐
│     React PWA (Vite + TS)       │
│  Tailwind + shadcn/ui + Framer  │
└─────────────┬───────────────────┘
              │ HTTPS
┌─────────────▼───────────────────┐
│     Lovable Cloud (Supabase)     │
│  ┌───────────┐ ┌──────────────┐ │
│  │ Auth      │ │ PostgreSQL   │ │
│  │ (JWT)     │ │ + RLS        │ │
│  └───────────┘ └──────────────┘ │
│  ┌───────────┐ ┌──────────────┐ │
│  │ Edge Fns  │ │ Realtime     │ │
│  │ (Deno)    │ │ (WebSocket)  │ │
│  └───────────┘ └──────────────┘ │
│  ┌───────────┐                  │
│  │ Storage   │                  │
│  └───────────┘                  │
└─────────────────────────────────┘
```

### Target Production Architecture (10M Users)

```
                    ┌──────────────────┐
                    │   CDN / WAF      │
                    │  (Cloudflare)    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   API Gateway    │
                    │  Rate Limiting   │
                    │  Auth Validation │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐  ┌──────────▼────────┐  ┌───────▼──────┐
│ Auth Service │  │ Transaction Engine│  │ Notification │
│ (Stateless)  │  │ (Event-Sourced)   │  │   Service    │
│ JWT + 2FA    │  │ Double-entry      │  │ Push/SMS/    │
│ Device bind  │  │ ledger            │  │ Email        │
└───────┬──────┘  └──────────┬────────┘  └──────────────┘
        │                    │
        │         ┌──────────▼────────┐
        │         │  Ledger DB        │
        │         │  (PostgreSQL +    │
        │         │   Citus for       │
        │         │   sharding)       │
        │         └───────────────────┘
        │
┌───────▼──────────────────────────────┐
│         Supporting Services          │
│  ┌─────────┐ ┌──────────┐ ┌───────┐ │
│  │ KYC     │ │ Fraud    │ │ Report│ │
│  │ Engine  │ │ Engine   │ │ Engine│ │
│  └─────────┘ └──────────┘ └───────┘ │
│  ┌─────────┐ ┌──────────┐ ┌───────┐ │
│  │ Fee     │ │Settlement│ │ Audit │ │
│  │ Engine  │ │ Engine   │ │ Logger│ │
│  └─────────┘ └──────────┘ └───────┘ │
└──────────────────────────────────────┘
```

### Technology Decisions

| Layer | Current | Production Target |
|-------|---------|-------------------|
| **Customer App** | React PWA | Flutter (iOS+Android) + PWA |
| **Agent/Merchant App** | — | Flutter |
| **Admin Dashboard** | — | React (current stack) |
| **API Gateway** | Supabase PostgREST | Kong / AWS API Gateway |
| **Auth** | Supabase Auth | Supabase Auth + device binding + 2FA |
| **Core DB** | Supabase PostgreSQL | PostgreSQL + Citus (horizontal sharding) |
| **Transaction Engine** | RPC function | Event-sourced microservice (Go/Rust) |
| **Message Queue** | — | Apache Kafka / AWS SQS |
| **Cache** | — | Redis Cluster |
| **Search** | — | Elasticsearch (txn search, fraud) |
| **Object Storage** | Supabase Storage | Supabase Storage / S3 |
| **Monitoring** | — | Prometheus + Grafana + PagerDuty |
| **Logging** | — | ELK Stack / Loki |

---

## 5. Database Architecture

### Current Schema (EasyPay)

```sql
-- profiles: user wallet + identity
-- transactions: all financial movements
-- saved_bank_accounts: linked banks
-- transfer_money(): atomic P2P RPC
```

### Target Schema (Full MFS)

#### Core Tables

```sql
-- ═══════════════════════════════════
-- IDENTITY & ACCESS
-- ═══════════════════════════════════

CREATE TYPE user_role AS ENUM (
  'customer', 'agent', 'merchant', 
  'distributor', 'super_distributor',
  'admin', 'compliance', 'finance'
);

CREATE TYPE kyc_tier AS ENUM ('tier0', 'tier1', 'tier2');
CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- user_roles table (separate from profiles per security requirements)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Extended profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  kyc_tier kyc_tier DEFAULT 'tier0',
  device_id TEXT,           -- bound device
  is_frozen BOOLEAN DEFAULT FALSE,
  frozen_reason TEXT,
  referral_code TEXT UNIQUE,
  referred_by UUID;

-- KYC Records
CREATE TABLE kyc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nid_number TEXT,
  nid_front_url TEXT,
  nid_back_url TEXT,
  selfie_url TEXT,
  liveness_score NUMERIC,
  ocr_data JSONB,
  status kyc_status DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════
-- WALLET & LEDGER
-- ═══════════════════════════════════

CREATE TYPE wallet_type AS ENUM (
  'customer', 'agent_float', 'merchant_settlement',
  'distributor_float', 'platform_revenue', 'escrow'
);

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type wallet_type NOT NULL,
  balance NUMERIC(15,2) DEFAULT 0.00,
  hold_balance NUMERIC(15,2) DEFAULT 0.00,  -- frozen/pending
  currency CHAR(3) DEFAULT 'BDT',
  is_active BOOLEAN DEFAULT TRUE,
  daily_txn_total NUMERIC(15,2) DEFAULT 0.00,
  daily_txn_count INT DEFAULT 0,
  daily_reset_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Double-entry ledger
CREATE TYPE ledger_entry_type AS ENUM ('debit', 'credit');

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  entry_type ledger_entry_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  balance_before NUMERIC(15,2) NOT NULL,
  balance_after NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════
-- AGENT & MERCHANT NETWORK
-- ═══════════════════════════════════

CREATE TYPE agent_status AS ENUM ('pending', 'active', 'suspended', 'terminated');

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  distributor_id UUID,            -- parent distributor
  business_name TEXT,
  territory_code TEXT,            -- geographic zone
  nid_number TEXT,
  trade_license TEXT,
  status agent_status DEFAULT 'pending',
  max_float NUMERIC(15,2) DEFAULT 500000,
  commission_earned NUMERIC(15,2) DEFAULT 0,
  customers_onboarded INT DEFAULT 0,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE merchant_category AS ENUM (
  'retail', 'restaurant', 'grocery', 'pharmacy',
  'transport', 'education', 'utility', 'other'
);

CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  category merchant_category DEFAULT 'retail',
  trade_license TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  bank_routing TEXT,
  mdr_rate NUMERIC(5,4) DEFAULT 0.0150,  -- 1.5% default
  settlement_frequency TEXT DEFAULT 'T+1',
  qr_code_data TEXT,
  status agent_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════
-- DISTRIBUTOR HIERARCHY
-- ═══════════════════════════════════

CREATE TABLE distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  parent_id UUID,                 -- super_distributor
  business_name TEXT NOT NULL,
  territory TEXT[],               -- array of territory codes
  max_float NUMERIC(15,2) DEFAULT 10000000,
  commission_rate NUMERIC(5,4) DEFAULT 0.0020,
  status agent_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════
-- FEE & COMMISSION CONFIGURATION
-- ═══════════════════════════════════

CREATE TABLE fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_type TEXT NOT NULL,           -- send, cashout, payment, etc.
  min_amount NUMERIC(15,2),
  max_amount NUMERIC(15,2),
  fee_type TEXT DEFAULT 'flat',     -- flat, percentage, tiered
  fee_value NUMERIC(10,4),          -- amount or percentage
  agent_commission NUMERIC(10,4),
  distributor_commission NUMERIC(10,4),
  platform_share NUMERIC(10,4),
  effective_from TIMESTAMPTZ DEFAULT now(),
  effective_to TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════
-- SETTLEMENTS
-- ═══════════════════════════════════

CREATE TYPE settlement_status AS ENUM (
  'pending', 'processing', 'completed', 'failed', 'reversed'
);

CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id),
  amount NUMERIC(15,2) NOT NULL,
  fee NUMERIC(15,2) DEFAULT 0,
  net_amount NUMERIC(15,2) NOT NULL,
  bank_account TEXT,
  bank_name TEXT,
  bank_reference TEXT,
  status settlement_status DEFAULT 'pending',
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════
-- AUDIT & COMPLIANCE
-- ═══════════════════════════════════

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE alert_status AS ENUM ('open', 'investigating', 'resolved', 'false_positive');

CREATE TABLE fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id UUID,
  rule_triggered TEXT NOT NULL,
  severity alert_severity DEFAULT 'medium',
  status alert_status DEFAULT 'open',
  details JSONB,
  assigned_to UUID,              -- compliance officer
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suspicious_transaction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID NOT NULL,     -- compliance officer
  user_id UUID NOT NULL,
  transaction_ids UUID[],
  category TEXT,                 -- structuring, layering, etc.
  narrative TEXT,
  filed_with_bfiu BOOLEAN DEFAULT FALSE,
  bfiu_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Entity Relationship Summary

```
auth.users 1──1 profiles 1──* wallets
                    │
                    ├──1 kyc_records
                    ├──1 agents ──* distributors
                    ├──1 merchants ──* settlements
                    └──* user_roles

wallets 1──* ledger_entries *──1 transactions
transactions *──* fraud_alerts
fee_config ──→ (applied during transaction processing)
```

---

## 6. Transaction Engine

### Double-Entry Ledger Principle

Every transaction creates **at least 2 ledger entries** (debit + credit) that sum to zero. This ensures the system is always balanced.

### Flow: Send Money (P2P)

```
1. Customer A initiates send → enters phone + amount + PIN
2. API validates: PIN correct, account active, sufficient balance, within limits
3. Transaction Engine (atomic):
   a. BEGIN TRANSACTION
   b. Lock sender wallet (FOR UPDATE)
   c. Lock receiver wallet (FOR UPDATE)
   d. Check sender balance ≥ amount + fee
   e. Debit sender wallet: amount + fee
   f. Credit receiver wallet: amount
   g. Credit platform revenue wallet: fee
   h. Insert transaction record (sender view)
   i. Insert transaction record (receiver view)
   j. Insert ledger entries (3: sender debit, receiver credit, fee credit)
   k. Update daily velocity counters
   l. COMMIT
4. Push notification to receiver
5. Fraud engine async check
6. Return success + receipt
```

### Flow: Cash Out

```
1. Customer initiates → enters agent number + amount
2. Fee calculated (tiered):
   ┌─────────────────┬──────────┬──────────────┬──────────────┐
   │ Amount Range     │ Fee      │ Agent Comm.  │ Platform Rev │
   ├─────────────────┼──────────┼──────────────┼──────────────┤
   │ ৳50–500          │ ৳5       │ ৳4           │ ৳1           │
   │ ৳501–1,000       │ ৳10      │ ৳8           │ ৳2           │
   │ ৳1,001–5,000     │ ৳15      │ ৳12          │ ৳3           │
   │ ৳5,001–10,000    │ ৳20      │ ৳16          │ ৳4           │
   │ ৳10,001–25,000   │ ৳25      │ ৳20          │ ৳5           │
   └─────────────────┴──────────┴──────────────┴──────────────┘
3. Customer confirms with PIN + slide
4. Transaction Engine (atomic):
   a. Debit customer wallet: amount + fee
   b. Credit agent float wallet: amount + commission
   c. Credit platform revenue: fee - commission
   d. Insert 2 transaction records + 3 ledger entries
5. Agent sees notification → gives cash to customer
```

### Flow: Merchant Payment

```
1. Customer scans merchant QR (contains merchant_id + optional amount)
2. If dynamic QR: amount pre-filled; if static: customer enters amount
3. MDR fee calculated: amount × merchant.mdr_rate (typically 1.5%)
4. Customer confirms with PIN
5. Transaction Engine:
   a. Debit customer wallet: amount
   b. Credit merchant settlement wallet: amount - MDR
   c. Credit platform revenue: MDR
   d. Insert records
6. Merchant gets instant payment notification with sound
7. Settlement batch processes at T+1 to merchant bank
```

### Flow: Settlement (Merchant → Bank)

```
1. Daily batch job at 2:00 AM:
   a. Query all merchant settlement wallets with balance > 0
   b. For each merchant:
      - Create settlement record
      - Generate bank transfer file (BEFTN format)
      - Debit merchant settlement wallet
      - Credit escrow/transit wallet
   c. Upload batch file to partner bank API
2. Bank processes transfers (BEFTN T+1)
3. Webhook/callback from bank confirms each transfer
4. Update settlement status → completed
5. If failed: reverse wallet debit, alert operations team
```

---

## 7. Security System

### Defense Layers

```
Layer 1: Network
├── WAF (Cloudflare) — DDoS, bot protection
├── TLS 1.3 everywhere
└── Certificate pinning in mobile apps

Layer 2: Authentication
├── Phone + PIN (current: phone-as-email pattern)
├── Device binding (device_id stored in profile)
├── Biometric (fingerprint/face as 2FA)
├── Session management (JWT, 15min access, 7d refresh)
└── Security lockout (5 attempts → 5min freeze)

Layer 3: Authorization
├── Row-Level Security (PostgreSQL RLS)
├── Role-based access (user_roles table)
├── API-level permission checks
└── Operation-specific PIN verification

Layer 4: Transaction Security
├── Atomic transactions (PostgreSQL SERIALIZABLE)
├── Double-entry ledger (self-balancing)
├── Velocity controls (daily limits per tier)
├── Amount limits (per txn type + tier)
└── Slide-to-confirm UX (prevents accidental sends)

Layer 5: Monitoring
├── Real-time fraud rules engine
├── Anomaly detection (ML-based)
├── Audit logging (every state change)
└── SIEM integration
```

### Velocity Controls

| KYC Tier | Daily Send | Daily Cash Out | Monthly Total | Max Balance |
|----------|-----------|---------------|---------------|-------------|
| Tier 0 | ৳5,000 | ৳5,000 | ৳25,000 | ৳10,000 |
| Tier 1 | ৳25,000 | ৳25,000 | ৳200,000 | ৳50,000 |
| Tier 2 | ৳200,000 | ৳100,000 | ৳1,000,000 | ৳500,000 |

### Fraud Detection Rules

| Rule ID | Name | Trigger | Action |
|---------|------|---------|--------|
| FR-001 | Rapid fire | >5 txns in 5 minutes | Block + alert |
| FR-002 | New account large txn | Txn >৳5000 within 24h of registration | Hold + review |
| FR-003 | Unusual hour | Txn >৳10000 between 1AM-5AM | Flag |
| FR-004 | Circular transfer | A→B→C→A within 1 hour | Block + investigate |
| FR-005 | Structuring | Multiple txns just below limit | Flag + STR |
| FR-006 | Agent anomaly | Agent processes >200 txns/day | Review |
| FR-007 | New device | Transaction from unbound device | Block + OTP verify |
| FR-008 | Dormant activation | No activity 90d then large txn | Hold + verify |

---

## 8. Compliance (Bangladesh Bank Aligned)

### KYC Tiers (per MFS Guidelines 2022)

| Tier | Requirements | Limits |
|------|-------------|--------|
| **Tier 0** | Phone number only | ৳10,000 balance, ৳5,000/day |
| **Tier 1** | NID + selfie match | ৳50,000 balance, ৳25,000/day |
| **Tier 2** | NID + biometric + address | ৳500,000 balance, ৳200,000/day |

### AML Monitoring

- **CTR (Cash Transaction Report):** Auto-generate for single txn ≥৳500,000
- **STR (Suspicious Transaction Report):** Compliance officer creates when patterns detected
- **Structuring Detection:** Flag multiple txns summing >৳500,000 within 24h from same user
- **PEP Screening:** Check against Politically Exposed Persons database
- **Sanctions Screening:** Check against OFAC/UN sanctions lists
- **Record Retention:** 5 years minimum for all KYC documents and transaction records

### Regulatory Reporting

| Report | Frequency | Recipient |
|--------|-----------|-----------|
| Daily Transaction Summary | Daily | Bangladesh Bank |
| CTR | Per occurrence | BFIU |
| STR | Per occurrence | BFIU |
| Monthly MIS | Monthly | Bangladesh Bank |
| Quarterly AML Report | Quarterly | BFIU |
| Annual Audit | Yearly | External auditor |

---

## 9. Agent Network Model

### Hierarchy

```
Platform (EasyPay)
│
├── Super Distributor (SD)
│   Capital: ৳50,00,000+
│   Territory: Division level
│   Commission: 0.20% of sub-network volume
│   │
│   ├── Distributor (D)
│   │   Capital: ৳10,00,000+
│   │   Territory: District level
│   │   Commission: 0.15% of agent network volume
│   │   │
│   │   ├── Agent (A1) — ৳50,000 float
│   │   ├── Agent (A2) — ৳100,000 float
│   │   └── Agent (A3) — ৳75,000 float
│   │
│   └── Distributor (D2) ...
│
└── Super Distributor (SD2) ...
```

### Float Management

```
1. SD deposits ৳50,00,000 to trust bank account
2. Platform credits SD float wallet: ৳50,00,000
3. SD transfers float to Distributor: ৳10,00,000
4. Distributor transfers float to Agent: ৳1,00,000
5. Agent uses float for cash-in/cash-out
6. Float replenishment cycle: Agent → Distributor → SD → Bank
```

### Commission Distribution (Cash Out ৳10,000 Example)

```
Customer pays: ৳10,000 + ৳20 fee = ৳10,020 debited
Agent receives: ৳10,000 + ৳16 commission = ৳10,016 credited
Distributor earns: ৳2 (from platform share)
Platform revenue: ৳20 - ৳16 - ৳2 = ৳2
```

---

## 10. Revenue Model

### Revenue Streams

| Stream | Rate | Monthly Est. (1M users) |
|--------|------|------------------------|
| **Cash-out fees** | ৳5–25 per txn | ৳15,00,00,000 |
| **Merchant MDR** | 1.0–1.5% | ৳3,00,00,000 |
| **Bill payment commission** | 0.5–1.0% from billers | ৳50,00,000 |
| **Recharge commission** | 1.5–2.0% from telcos | ৳30,00,000 |
| **Float interest** | ~4% annual on pooled funds | ৳2,00,00,000 |
| **P2P fees** | Free (growth driver) | ৳0 |
| **Premium services** | Lending, insurance, savings | Future |

### Unit Economics (per active user/month)

```
Average revenue per user (ARPU): ৳45
Customer acquisition cost (CAC): ৳150
Lifetime value (LTV): ৳2,700 (5 yr, 80% retention)
LTV:CAC ratio: 18:1 ✅
```

---

## 11. Settlement System

### Daily Settlement Cycle

```
T+0 (Transaction Day):
  00:00–23:59: Transactions processed in real-time
  
T+1 (Settlement Day):
  02:00: Batch job calculates net positions
  03:00: Generate BEFTN/RTGS files
  04:00: Submit to partner bank
  10:00: Bank processes interbank transfers
  14:00: Confirmation received
  14:30: Update settlement records
  15:00: Notify merchants of completed settlements
```

### Trust Account Reconciliation

```
Daily reconciliation check:
  Trust Bank Balance
  = Sum(all customer wallet balances)
  + Sum(all agent float balances)  
  + Sum(all merchant settlement balances)
  + Sum(pending settlements in transit)
  + Platform revenue (not yet withdrawn)

  Variance tolerance: ৳0.00 (must be exact)
  If variance > 0: ALERT → immediate investigation
```

---

## 12. Scalability Plan (10M Users, 1M Daily TPS)

### Infrastructure Sizing

| Component | Specification |
|-----------|--------------|
| **API Servers** | 8× c5.2xlarge (auto-scale to 24) |
| **PostgreSQL Primary** | r5.4xlarge (16 vCPU, 128GB RAM) |
| **PostgreSQL Read Replicas** | 3× r5.2xlarge |
| **Redis Cluster** | 3-node, r6g.xlarge |
| **Kafka** | 3-broker, m5.2xlarge |
| **Elasticsearch** | 3-node, r5.2xlarge |

### Database Sharding Strategy

```
Shard by user_id (Citus):
  - wallets: sharded on user_id
  - transactions: sharded on user_id
  - ledger_entries: sharded on wallet_id → user_id
  
Reference tables (replicated to all shards):
  - fee_config
  - user_roles
```

### Disaster Recovery

```
RPO (Recovery Point Objective): 0 seconds (synchronous replication)
RTO (Recovery Time Objective): < 5 minutes (automated failover)

Backup strategy:
  - Continuous WAL archiving to S3
  - Daily full backups (retained 30 days)
  - Cross-region replication (Dhaka ↔ Singapore)
  - Monthly DR drill
```

---

## 13. Fraud & Risk System

### Rule Engine Architecture

```
Transaction → Pre-screening Rules (sync, <50ms)
                    │
                    ├── PASS → Process transaction
                    │            │
                    │            └── Post-screening Rules (async)
                    │                     │
                    │                     ├── CLEAN → Done
                    │                     └── SUSPICIOUS → Create alert
                    │
                    ├── REVIEW → Hold transaction + alert compliance
                    │
                    └── BLOCK → Reject + freeze + alert
```

### ML-Based Anomaly Detection

- **Features:** Transaction amount, frequency, time of day, recipient pattern, device info, location
- **Model:** Isolation Forest for outlier detection
- **Training:** Monthly retrain on labeled fraud/non-fraud data
- **Threshold:** Score > 0.85 → auto-block, 0.60–0.85 → manual review

---

## 14. UI/UX Screen Hierarchy

### Customer App (Current EasyPay + Planned)

```
Splash → Onboarding → Auth
│
├── Home
│   ├── Balance Card
│   ├── Quick Actions (8 icons)
│   ├── Promo Banner
│   └── Recent Transactions
│
├── Send Money Flow
│   ├── Enter Phone/Contact
│   ├── Enter Amount
│   ├── Review + Fee
│   └── PIN + Slide → Success
│
├── Cash Out Flow (similar)
├── Payment Flow (QR scan → amount → confirm)
├── Recharge Flow (operator → number → plan → confirm)
├── Bill Pay Flow (biller → account → amount → confirm)
├── Add Money Flow (bank → amount → confirm)
│
├── Transaction History
│   ├── Filters (type, date, status)
│   ├── Transaction Detail → Receipt → Share
│   └── Export Statement
│
├── Inbox (request money, notifications)
├── Spending Insights (charts)
│
├── Account
│   ├── Profile Edit
│   ├── KYC Verification
│   ├── Security Settings
│   │   ├── Change PIN
│   │   ├── Biometric Toggle
│   │   └── Device Management
│   ├── Limits & Charges
│   ├── Refer & Earn
│   ├── Language (EN/BN)
│   └── Help & Support
│
└── Scan & Pay (QR Camera)
```

### Agent App (Planned)

```
├── Dashboard
│   ├── Float Balance
│   ├── Today's Summary (txns, commission)
│   └── Quick Actions
│
├── Cash In (customer deposit)
├── Cash Out (customer withdrawal)
├── Customer Registration
│
├── Float Management
│   ├── Request Float
│   ├── Float History
│   └── Low Float Alert
│
├── Commission
│   ├── Earnings Dashboard
│   ├── Commission History
│   └── Withdraw to Bank
│
└── Profile & Settings
```

### Admin Dashboard (Planned)

```
├── Overview Dashboard
│   ├── Active Users / Txn Volume / Revenue
│   ├── Real-time Transaction Feed
│   └── System Health
│
├── User Management
│   ├── Search & View Users
│   ├── Freeze/Unfreeze
│   ├── Tier Upgrade
│   └── KYC Review Queue
│
├── Transaction Monitor
│   ├── Search (by ID, phone, date, type)
│   ├── Transaction Detail
│   ├── Reversal
│   └── Dispute Management
│
├── Agent Management
│   ├── Onboard Agent
│   ├── Agent Directory
│   ├── Territory Map
│   └── Performance Rankings
│
├── Merchant Management
│   ├── Onboard Merchant
│   ├── QR Generation
│   ├── Settlement Queue
│   └── MDR Configuration
│
├── Finance
│   ├── Revenue Dashboard
│   ├── Settlement Processing
│   ├── Reconciliation
│   └── Trust Account Balance
│
├── Compliance
│   ├── Fraud Alerts Queue
│   ├── STR Filing
│   ├── AML Dashboard
│   └── Regulatory Reports
│
└── Configuration
    ├── Fee/Commission Tables
    ├── Transaction Limits
    ├── Feature Flags
    └── System Settings
```

---

## 15. API Design

### Authentication APIs

```
POST   /auth/register          → Phone + PIN signup
POST   /auth/login             → Phone + PIN login
POST   /auth/verify-otp        → OTP verification
POST   /auth/refresh           → Refresh JWT token
POST   /auth/logout            → Invalidate session
POST   /auth/change-pin        → Update PIN
POST   /auth/reset-pin         → PIN reset via OTP
POST   /auth/bind-device       → Register device ID
DELETE /auth/unbind-device      → Remove device binding
```

### Wallet APIs

```
GET    /wallet/balance          → Current balance + hold
GET    /wallet/limits           → Remaining daily/monthly limits
GET    /wallet/statement        → Paginated transaction history
GET    /wallet/statement/export → PDF/CSV download
```

### Transaction APIs

```
POST   /txn/send               → P2P send money
POST   /txn/cashout             → Cash out to agent
POST   /txn/cashin              → Agent cash-in for customer
POST   /txn/payment             → Merchant payment
POST   /txn/recharge            → Mobile recharge
POST   /txn/bill-pay            → Bill payment
POST   /txn/add-money           → Bank to wallet
POST   /txn/request-money       → Request from contact
GET    /txn/:id                 → Transaction detail
POST   /txn/:id/refund          → Initiate refund
```

### Agent APIs

```
GET    /agent/dashboard         → Float + daily summary
POST   /agent/float/request     → Request float from distributor
GET    /agent/commission        → Commission history
POST   /agent/customer/register → Onboard new customer
```

### Merchant APIs

```
GET    /merchant/dashboard      → Sales summary
POST   /merchant/qr/generate   → Generate payment QR
GET    /merchant/settlements    → Settlement history
POST   /merchant/settlement/request → Manual settlement
POST   /merchant/refund/:txn_id → Process refund
```

### Admin APIs

```
GET    /admin/users             → Search/list users
PATCH  /admin/users/:id/freeze  → Freeze account
PATCH  /admin/users/:id/tier    → Update KYC tier
GET    /admin/txns              → Global transaction search
POST   /admin/txns/:id/reverse  → Reverse transaction
GET    /admin/kyc/queue         → Pending KYC reviews
PATCH  /admin/kyc/:id           → Approve/reject KYC
GET    /admin/fraud/alerts      → Fraud alert queue
PATCH  /admin/fraud/:id         → Resolve alert
GET    /admin/reports/:type     → Generate regulatory report
PATCH  /admin/config/fees       → Update fee configuration
```

---

## 16. DevOps & Deployment

### CI/CD Pipeline

```
Developer Push → GitHub
       │
       ▼
  GitHub Actions
  ┌──────────────┐
  │ 1. Lint       │
  │ 2. Type Check │
  │ 3. Unit Tests │
  │ 4. Build      │
  └──────┬───────┘
         │
    ┌────▼─────┐
    │ Staging   │ ← Auto-deploy on main branch
    │ (preview) │
    └────┬─────┘
         │ Manual approval
    ┌────▼──────┐
    │ Production │ ← Blue-green deployment
    │            │
    └────────────┘
```

### Monitoring Stack

```
Metrics:    Prometheus → Grafana dashboards
Logs:       App → Loki → Grafana
Errors:     Sentry (client + server)
Alerts:     PagerDuty (P1: <5min response)
Uptime:     Pingdom / UptimeRobot
APM:        Datadog / New Relic
```

### Backup Strategy

| Data | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| PostgreSQL WAL | Continuous | 7 days | S3 cross-region |
| Full DB dump | Daily 3AM | 30 days | S3 + Glacier |
| File storage | Daily | 90 days | S3 cross-region |
| Config/secrets | On change | 30 versions | Vault |
| Audit logs | Immutable | 7 years | S3 Glacier Deep |

---

## 17. Business Launch Strategy

### Phase 1: Foundation (Month 1–3)
- [ ] Obtain MFS license from Bangladesh Bank
- [ ] Partner with trust bank (e.g., Bank Asia, Eastern Bank)
- [ ] Build core platform (customer app + basic admin)
- [ ] Internal testing + security audit
- [ ] Recruit founding agent network (500 agents in Dhaka)

### Phase 2: Soft Launch (Month 4–6)
- [ ] Launch in Dhaka only
- [ ] P2P + Cash In/Out + Recharge
- [ ] Target: 50,000 users, 5,000 daily txns
- [ ] Iterate based on user feedback
- [ ] Build merchant onboarding pipeline

### Phase 3: Expansion (Month 7–12)
- [ ] Expand to Chittagong, Sylhet, Rajshahi
- [ ] Launch merchant payments + bill pay
- [ ] Agent network: 5,000 agents nationwide
- [ ] Target: 500,000 users
- [ ] Launch referral program

### Phase 4: Scale (Year 2)
- [ ] Full nationwide coverage
- [ ] 50,000+ agent network
- [ ] Launch savings products
- [ ] Launch micro-lending (partnership with banks)
- [ ] Target: 5M users, 500K daily txns

### Phase 5: Ecosystem (Year 3+)
- [ ] Cross-border remittance
- [ ] Virtual/physical debit card
- [ ] Open API platform
- [ ] Insurance products
- [ ] Credit scoring
- [ ] Target: 10M+ users

---

## 18. Future Expansion

### Lending
- Nano-loans (৳500–৳5,000) based on transaction history
- Salary advance for corporate partnerships
- BNPL (Buy Now Pay Later) for merchant payments
- Interest rate: 10–15% annual, 30-day terms

### Savings
- Goal-based savings (already UI-built in EasyPay)
- Daily profit-sharing savings (Islamic finance compliant)
- Fixed deposit partnership with banks
- Auto-save (round-up transactions)

### Cross-Border Remittance
- Partner with Wise, Remitly, or build direct corridor
- UAE ↔ Bangladesh corridor (largest remittance flow)
- Real-time credit to wallet
- Competitive FX rates

### Virtual Cards
- Virtual Visa/Mastercard for online shopping
- International payment capability
- Dynamic CVV for security
- Spending controls

### Open API Platform
- Developer portal
- Payment gateway API (compete with SSLCommerz)
- Webhook notifications
- SDKs for iOS, Android, Web
- Sandbox environment for testing

---

## Implementation Priority for EasyPay

### What's Already Built ✅
1. Customer wallet + auth
2. P2P send money (atomic)
3. Cash out flow (with agent commission)
4. Merchant payment flow
5. Mobile recharge + bill pay
6. Transaction history + insights
7. KYC UI flow
8. Referral system
9. Biometric auth
10. Bengali/English i18n
11. PWA + offline support
12. Real-time balance + txn updates

### Next Steps (Recommended Priority)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| **P0** | Admin dashboard (basic) | 2 weeks | Operational necessity |
| **P0** | KYC backend verification | 1 week | Compliance requirement |
| **P1** | Agent app (dedicated) | 2 weeks | Network growth |
| **P1** | Merchant settlement system | 1 week | Revenue enablement |
| **P1** | Double-entry ledger migration | 1 week | Audit compliance |
| **P2** | Fraud detection rules | 1 week | Risk management |
| **P2** | Fee configuration (admin) | 3 days | Flexibility |
| **P2** | Statement PDF export | 2 days | User feature |
| **P3** | Distributor management | 1 week | Scale agent network |
| **P3** | Savings product backend | 3 days | Revenue diversification |
