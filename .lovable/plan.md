## Drive Pack Flow: Number Entry After Pack Selection

### Current Flow (operator tap path)

Tap operator → Browse packs → Select pack → Amount → PIN → Success

The problem: when user taps an operator card to browse drive packs, a **dummy phone number** (`017-0000-0000`) is set automatically. The user never enters the actual recipient number for the selected pack.

### New Flow

Tap operator → Browse drive packs → Select pack → **Enter number** → Amount (locked after selecting pack amount) → PIN → Success

### Changes

**File: `src/components/MobileRechargeFlow.tsx**`

1. **Track whether phone was entered manually vs auto-filled**: Add a `phoneDummy` ref/state that's `true` when the phone was set by `handleOperatorTap` (the dummy prefix fill).
2. **Modify `handlePackContinue**`: For drive packs, if the phone is a dummy, redirect to a number entry sub-step instead of going straight to "amount". After entering a valid number on that step, continue to "amount" with the selected pack preserved.
3. **Adjust `goBack` logic**: When going back from the number step with a selected pack, return to "packs" instead of closing. When going back from "amount" with a pack selected (operator-browse path), return to "number" step.
4. **Number step UI tweak**: When a pack is already selected (drive pack flow), show a summary of the selected pack above the phone input so the user knows what they're recharging with, and change the CTA to "Continue with [Pack Name]".


| Area                   | Change                                               |
| ---------------------- | ---------------------------------------------------- |
| State                  | Add `isPhoneDummy` boolean flag                      |
| `handleOperatorTap`    | Set `isPhoneDummy = true`                            |
| `handlePackContinue`   | If drive pack + dummy phone → go to "number" step    |
| Number step UI         | Show selected pack summary when pack is pre-selected |
| `handleNumberContinue` | Clear dummy flag, proceed to "amount"                |
| `goBack`               | Number step with selected pack → back to "packs"     |
