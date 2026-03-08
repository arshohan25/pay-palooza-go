import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

const STORAGE_KEY = "quickaction-order";
const DEFAULT_ORDER = ["bank", "recharge", "bill", "shop", "more"];

function loadLocalOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      if (parsed.length === DEFAULT_ORDER.length && DEFAULT_ORDER.every(id => parsed.includes(id))) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_ORDER;
}

export function useQuickActionOrder() {
  const { user } = useAuth();
  const [order, setOrderState] = useState<string[]>(loadLocalOrder);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from DB when user is available
  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("user_quick_action_order" as any)
        .select("action_order")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data && Array.isArray((data as any).action_order)) {
        const dbOrder = (data as any).action_order as string[];
        if (dbOrder.length === DEFAULT_ORDER.length && DEFAULT_ORDER.every(id => dbOrder.includes(id))) {
          setOrderState(dbOrder);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbOrder));
        }
      }
      setLoaded(true);
    })();
  }, [user]);

  // Save to DB (debounced)
  const persistToDB = useCallback((newOrder: string[]) => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      // Upsert
      await supabase
        .from("user_quick_action_order" as any)
        .upsert(
          { user_id: user.id, action_order: newOrder, updated_at: new Date().toISOString() } as any,
          { onConflict: "user_id" }
        );
    }, 800);
  }, [user]);

  const setOrder = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    setOrderState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      persistToDB(next);
      return next;
    });
  }, [persistToDB]);

  const resetOrder = useCallback(() => {
    setOrder(DEFAULT_ORDER);
  }, [setOrder]);

  const isCustomOrder = JSON.stringify(order) !== JSON.stringify(DEFAULT_ORDER);

  return { order, setOrder, resetOrder, isCustomOrder, loaded, DEFAULT_ORDER };
}
