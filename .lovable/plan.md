

# Fix: Chat "Add by Phone" Does Nothing

## Problem
When a user enters a phone number in the "Add by Phone" sheet and taps "Start Conversation," the sheet shows a premature "Conversation Started!" animation and closes — but no chat actually opens. Two bugs:

1. **Premature success**: The sheet shows success UI (`setSent(true)`) before the backend verifies whether the user exists. After 1.8 seconds it fires the async `onCreate` callback and immediately calls `onClose()`, never awaiting the result.
2. **No error feedback**: If `findUserByPhone` returns null (user not found), the error toast fires after the sheet is already gone, and the success animation already played — so the user sees "Conversation Started!" but nothing actually happens.

## Fix

### File: `src/pages/InboxPage.tsx`

**`NewContactSheet` component (lines ~545-619)**
- Change `onCreate` prop type from `(phone: string) => void` to `(phone: string) => Promise<boolean>` so the sheet can await the result.
- On "Start Conversation" click: show a loading spinner, call `await onCreate(phone)`, then either show the success animation (if true) or show an error inline (if false). Only call `onClose()` after a successful result + brief delay.

**`handleCreateContact` function (lines ~1290-1300)**
- Change return type to `Promise<boolean>` — return `true` on success, `false` on failure.
- Keep existing logic (findUserByPhone, createDirectConversation, toast messages).

### Summary
Two changes in one file. The sheet now awaits the API result before showing success/failure, and closes only after a confirmed conversation is created.

