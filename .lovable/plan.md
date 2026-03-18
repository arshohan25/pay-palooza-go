

## Add Chat Button to Bottom Action Bar

The screenshot shows you want a chat/message icon button in the bottom fixed bar, next to the cart icon (left side). The chat handler already exists in the component -- it just needs to be wired into the bottom bar.

### Change: `src/pages/ProductDetailPage.tsx` (lines 508-521)

Add a `MessageCircle` icon button next to the existing cart icon button in the fixed bottom bar:

```
[Chat] [Cart]  [  Add to Cart  ] [  Buy Now  ]
```

- Insert a new `Button` with `MessageCircle` icon right next to the shopping cart button
- Wire it to the existing `handleChatWithMerchant` callback
- Show a loading spinner when `chattingWithMerchant` is true
- Disable the button if the product belongs to the current user (self-store check)

This is a single-line addition -- no new files, no new logic needed since `handleChatWithMerchant` already handles auth guards, conversation creation, context message, and navigation to inbox.

### Files
- **Modified**: `src/pages/ProductDetailPage.tsx` -- add MessageCircle button to fixed bottom bar

