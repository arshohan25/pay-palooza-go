import { useState, useCallback } from "react";
import type { ShopProduct } from "@/components/shop/ProductCard";
import type { CartItem } from "@/components/shop/CartDrawer";
import { toast } from "sonner";

const CART_KEY = "easypay_cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  const addToCart = useCallback((product: ShopProduct, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      let next: CartItem[];
      if (existing) {
        next = prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + qty } : i);
        toast.success(`Updated quantity`);
      } else {
        next = [...prev, { ...product, qty }];
        toast.success(`Added to cart`);
      }
      saveCart(next);
      return next;
    });
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    setItems((prev) => {
      let next: CartItem[];
      if (qty <= 0) {
        next = prev.filter((i) => i.id !== productId);
      } else {
        next = prev.map((i) => i.id === productId ? { ...i, qty } : i);
      }
      saveCart(next);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== productId);
      saveCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_KEY);
  }, []);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return { items, addToCart, updateQty, removeFromCart, clearCart, total, count };
}
