

## Rearrange Admin Dashboard Navigation into Logical Sections

### Problem
Several nav items are in unrelated sections (e.g., Orders in Operations instead of E-Commerce, Fund Requests in Operations instead of Financial, Recharge/Billers in System instead of Services, Fraud Alerts split across multiple groups).

### Proposed Reorganization

```text
Overview         : Dashboard, Users, Team, Team Activity
Operations       : Transactions, Chargebacks, MFS Monitor, Disputes, Complaints, KYC, Fund Requests
Support          : Support, Chat Monitor
Network          : Agent Hub, Leaderboard, Merchants, Merchant Apps, Distributors, Wallets, Referrals
Financial        : Commissions, Commission Log, Charges, Limits, Settlements, Bank Recon, Treasury, Float Mgmt, Revenue, Deposit Accts
Services         : Loans, Insurance, Gift Cards, Savings, Donation Funds, Auto-Save, Recharge, Billers
E-Commerce       : E-Commerce, Orders
System           : Gateways, Toggles, Locks, Permissions, Settings, API Hub, API Requests, Webhooks, Devices, OTP Monitor, Sessions, Health
Security & Risk  : Fraud Alerts, Security, Risk Control, Blacklist
⭐ Pro Fintech   : AI Fraud, Auto Rules, Geo Track, Routing, Liquidity, Live Monitor
Marketing        : Marketing, Banners, Loyalty, Notify, Announcements, Feedback, Changelog, Festivals
Reports          : Reports, Adv. Reports, Audit Log, Export
HR               : Careers
Other            : Trash
```

### Key Moves
- **Orders** → E-Commerce (was Operations)
- **Fund Requests** → Operations (financial ops, stays)
- **Merchant Apps** → Network (with Merchants)
- **API Requests** → System (with API Hub)
- **Savings, Donation Funds, Auto-Save** → Services (was Financial)
- **Recharge, Billers** → Services (was System)
- **Fraud Alerts** → Security & Risk (was Overview)
- **Risk Control, Blacklist** → Security & Risk (was System)
- **Team, Team Activity** → Overview (was Other)
- **Support, Chat Monitor** → new Support group (was Operations)

### File Modified
1. `src/pages/AdminDashboard.tsx` — rewrite `NAV_GROUPS` array only

