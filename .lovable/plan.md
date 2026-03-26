

# Move Greeting Outside Balance Card

## Problem
The "WELCOME BACK" greeting and user name currently sit inside the top of the balance card. The user wants this greeting moved above the card as a standalone element (between the header and the balance card).

## Changes

**`src/pages/Index.tsx`**
- Add a greeting row between `<FestivalOverlay />` and `<BalanceCard />` (around line 248):
  ```
  <div className="flex items-center gap-1.5">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {t("welcomeBack")}
    </p>
    <span className="text-sm">👋</span>
  </div>
  <p className="text-[17px] font-bold text-foreground -mt-3">{displayName}</p>
  ```
- Import `useProfile` and `useI18n` to get `displayName` and `t`.

**`src/components/BalanceCard.tsx`**
- Remove the greeting block (lines 106-110): the "WELCOME BACK" text and `userName` display.
- Adjust the top row so only the QR + Copy buttons remain on the right, and the left side starts with the balance section or is removed.

Two files changed. The greeting moves from inside the card to a standalone position above it.

