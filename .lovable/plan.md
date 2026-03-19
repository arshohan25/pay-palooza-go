

## Move Chat Option to Bottom Bar

### Change
**File: `src/pages/ProductDetailPage.tsx`**

1. **Remove** the floating FAB block (lines 521-549) entirely
2. **Modify** the fixed bottom bar (line 552+) to include a chat button on the left side of "Add to Cart":

```tsx
<div className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/50 px-3 py-3 flex items-center gap-2.5 safe-area-bottom">
  {merchantUserId && merchantUserId !== user?.id && (
    <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0 relative"
      onClick={handleChatWithMerchant} disabled={chattingWithMerchant}>
      {chattingWithMerchant ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
      <span className={cn("absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-card",
        merchantOnline ? "bg-emerald-500" : "bg-muted-foreground/40")} />
    </Button>
  )}
  <Button variant="outline" size="lg" className="flex-1 rounded-xl h-11 text-sm font-bold" ...>Add to Cart</Button>
  <Button size="lg" className="flex-1 rounded-xl h-11 text-sm font-bold" ...>Buy Now</Button>
</div>
```

The chat button becomes a compact icon button with the online indicator dot, sitting to the left of "Add to Cart" in the sticky bottom bar. No floating element needed.

