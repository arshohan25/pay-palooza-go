

## Verification: Product Inquiry Chat Flow

### Current Status: Fully Implemented

The end-to-end flow is correctly wired:

1. **ProductDetailPage** (`handleChatWithMerchant`): Creates a direct conversation with the merchant's `user_id`, sends a message with product metadata (`isProductInquiry: true`, `productName`, `productPrice`, `productImage`, `productEmoji`), then navigates to `/inbox?conv={convId}`

2. **use-chat hook** (`sendMessage`): Accepts metadata as 4th argument, stores it as JSON in `chat_messages.metadata` column

3. **InboxPage** (`msgToUIMessage`): Detects `isProductInquiry` in metadata, sets message type to `"product"`, extracts all product fields

4. **InboxPage** (ProductBubble rendering): Renders a rich card with product image/emoji, name, price, and "Product Inquiry" label

5. **Deep-linking**: Reads `?conv=` param to auto-open the correct conversation

6. **Unread tracking**: The `useChat` hook tracks `totalUnread` count which powers badge indicators

### Testing Limitation

The current logged-in user (`897da592...`) owns the only merchant store ("Rafiq Electronics"). Tapping Chat on their own products triggers `"This is your own store"` guard (line 98). To test the full flow, you need a **second user account** that is not the merchant owner.

### Recommended Test Steps

1. Log out and create/log in with a second test account
2. Navigate to Shop, open a product from "Rafiq Electronics"
3. Tap the Chat button in the bottom bar
4. Verify: navigates to Inbox with the conversation auto-opened
5. Verify: a rich product card bubble appears showing product name, emoji, and price
6. Log back into the merchant account
7. Verify: the conversation appears with an unread badge and the product inquiry card is visible

### No Code Changes Needed

The implementation is complete and correct. No bugs found in the flow.

