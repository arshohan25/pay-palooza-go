

Looking at screenshot: "Dream Bike" goal is completed (৳5,000 manual deposit shown on timeline, ৳2,600 saved label up top is stale but goal is completed). Yet the **ADD DEPOSIT** card with PIN + Slide to Save is still rendered below. User correctly points out: a completed goal shouldn't accept more deposits.

Let me trace the deposit form rendering.
<lov-tool-use id="toolu_vrtx_019CLH6Y5NkG4SxcJuWUiyuX" name="code--search_files" integration-id="code" data="{\"query\": \"ADD DEPOSIT|Slide to Save|add deposit\", \"include_patterns\": \"src/components/SavingsFlow.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FyyQ4AkknPzZP5aDKz7dPr" name="code--search_files" integration-id="code" data="{\"query\": \"ADD DEPOSIT|Slide to Save|selectedGoal\", \"include_patterns\": \"src/components/SavingsFlow.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01V1GfABbL9Zypj3kPz5BZu5" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/SavingsFlow.tsx\", \"lines\": \"1800-1900\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01G23QmzNHkjyQj4ycQL2GDh" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/SavingsFlow.tsx\", \"lines\": \"1900-2010\"}">
</lov-tool-use>
I have enough context. The Goal Detail view (line 1914-1935) unconditionally renders the "Add Deposit" section + PIN + Slide to Save, regardless of whether the goal is `completed` or `withdrawn`.

<lov-plan>

## Hide deposit form on completed/withdrawn goals

### Bug
On the Goal Detail screen (`/savings` → Goals tab → tap a goal), the "Add Deposit" card, PIN entry, and "Slide to Save" slider are **always rendered** — even after the goal is `completed` or `withdrawn`. User screenshot shows ৳500 + ৳5,000 manual deposits (goal already completed) yet "Add Deposit" + PIN + slider still appear, inviting more deposits into a finished goal.

### Root cause
`src/components/SavingsFlow.tsx` lines **1914-1935** render the Deposit + PIN + Slider block with no status guard:
```tsx
<div className="bg-card …">
  <p>Add Deposit</p>
  <input … />
  …
</div>
<SavingsPinInput … />
<SlideToConfirm onConfirm={handleSave} … />
```

### Fix (single file)

**`src/components/SavingsFlow.tsx`** — wrap the entire Deposit + PIN + Slider block (lines 1914-1935) in:
```tsx
{selectedGoal.status === "active" ? (
  <> … existing Add Deposit + PIN + SlideToConfirm … </>
) : selectedGoal.status === "completed" ? (
  // Completion banner + "Withdraw to Wallet" CTA (reuses existing handleWithdrawGoal)
  <div className="bg-gradient-to-br from-emerald-500/10 to-amber-400/10 border border-emerald-500/30 rounded-[20px] p-5 text-center space-y-3">
    <CheckCircle2 className="mx-auto text-emerald-500" size={36} />
    <p className="text-[15px] font-black">Goal Completed 🎉</p>
    <p className="text-[12px] text-muted-foreground">
      You've reached your ৳{target} target. Withdraw your savings to your wallet.
    </p>
    <button onClick={() => handleWithdrawGoal(selectedGoal.id, selectedGoal.name, saved)}
      className="w-full py-3 rounded-[14px] bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-[13px]">
      Withdraw ৳{saved.toLocaleString()} to Wallet
    </button>
  </div>
) : (
  // status === "withdrawn"
  <div className="bg-muted/40 border border-border/60 rounded-[20px] p-5 text-center">
    <CheckCircle2 className="mx-auto text-muted-foreground mb-2" size={28} />
    <p className="text-[13px] font-bold">Goal Closed</p>
    <p className="text-[11px] text-muted-foreground mt-1">Funds withdrawn to your wallet. This goal is archived.</p>
  </div>
)}
```

Same logic applies in the Goals **list view** (around line 941-945): the "tap to add deposit" `<button>` should be disabled when `status !== 'active'` so users can't enter the deposit step at all on a closed goal. The button there already shows `<CheckCircle2 />` instead of an arrow when completed but the wrapping `<button>` is still clickable — gate the `onClick`.

### What user sees after fix
- **Active goal** → Add Deposit + PIN + Slide (unchanged).
- **Completed goal** → Big celebration card with "Withdraw ৳X to Wallet" button (no deposit form).
- **Withdrawn goal** → "Goal Closed" archive card (no actions).

### Files touched
- `src/components/SavingsFlow.tsx` — guard the deposit block in Goal Detail view + disable open-detail click on non-active goals in the list.

### Out of scope
- No DB changes (statuses already correct).
- No new RPC (uses existing `handleWithdrawGoal`).

