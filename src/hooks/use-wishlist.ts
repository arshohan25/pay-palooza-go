import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function useWishlist() {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWishlistIds(new Set());
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data } = await (supabase as any)
        .from("wishlists")
        .select("product_id")
        .eq("user_id", user.id);
      setWishlistIds(new Set(data?.map((w: any) => w.product_id) ?? []));
      setLoading(false);
    };
    load();
  }, [user]);

  const toggle = useCallback(async (productId: string) => {
    if (!user) {
      toast.error("Please login to add to wishlist");
      return;
    }

    const isWishlisted = wishlistIds.has(productId);
    
    // Optimistic update
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (isWishlisted) next.delete(productId);
      else next.add(productId);
      return next;
    });

    if (isWishlisted) {
      await (supabase as any)
        .from("wishlists")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);
      toast.success("Removed from wishlist");
    } else {
      await (supabase as any)
        .from("wishlists")
        .insert({ user_id: user.id, product_id: productId });
      toast.success("Added to wishlist");
    }
  }, [user, wishlistIds]);

  return { wishlistIds, loading, toggle, isWishlisted: (id: string) => wishlistIds.has(id) };
}
