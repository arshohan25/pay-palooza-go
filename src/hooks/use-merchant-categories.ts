import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MerchantCategory {
  id: string;
  name: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

let cachedCategories: MerchantCategory[] | null = null;

export function useMerchantCategories() {
  const [categories, setCategories] = useState<MerchantCategory[]>(cachedCategories ?? []);
  const [loading, setLoading] = useState(!cachedCategories);

  useEffect(() => {
    if (cachedCategories) return;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("merchant_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      const result = data ?? [];
      cachedCategories = result;
      setCategories(result);
      setLoading(false);
    };
    load();
  }, []);

  /**
   * Add a category. In strict mode, throws a clear error if a matching
   * (case-insensitive, trimmed) category already exists — for the "Other" flow.
   */
  const addCategory = async (_name: string, label: string, opts: { strict?: boolean } = {}) => {
    const { data: name, error } = await (supabase as any)
      .rpc("add_merchant_category_if_missing", { _label: label, _strict: !!opts.strict });
    if (error) {
      // Postgres unique_violation returns 23505
      if ((error as any).code === "23505" || /already exists/i.test(error.message)) {
        throw new Error(`A category matching "${label.trim()}" already exists. Pick it from the list.`);
      }
      throw error;
    }
    const { data: rows } = await (supabase as any)
      .from("merchant_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    const result = rows ?? [];
    cachedCategories = result;
    setCategories(result);
    return result.find((c: MerchantCategory) => c.name === name) ?? { name, label } as MerchantCategory;
  };

  const refresh = async () => {
    const { data } = await (supabase as any)
      .from("merchant_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    cachedCategories = (data ?? []).filter((c: MerchantCategory) => c.is_active);
    setCategories(cachedCategories);
    return data ?? [];
  };

  const getLabelForName = (name: string) => {
    const found = categories.find(c => c.name === name);
    return found?.label || name.replace(/_/g, " ");
  };

  return { categories, loading, addCategory, getLabelForName, refresh };
}
