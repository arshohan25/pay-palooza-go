

## Testing the Product Inquiry Chat Flow

This is a **manual testing task** that cannot be automated from within the editor. The current logged-in user owns the only merchant store ("Rafiq Electronics"), so the "This is your own store" guard blocks self-testing.

### Steps to Test

1. **Open the app** in an incognito/private browser window: `https://pay-palooza-go.lovable.app`
2. **Create a new account** with a different phone number (e.g., `01712345678`) and any 4-digit PIN
3. **Navigate to Shop** from the home screen
4. **Open any Rafiq Electronics product**
5. **Tap the Chat button** in the bottom action bar
6. **Verify**: You are redirected to the Inbox with the conversation auto-opened and a rich product card (emoji, name, price) appears as the first message
7. **Switch back to your original account** (main browser window)
8. **Open the Inbox** and verify:
   - The conversation appears with an **unread badge**
   - The product inquiry card is visible with correct product details

### No Code Changes Needed

The implementation is complete. This plan is for manual verification only.

