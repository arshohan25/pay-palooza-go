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

  const addCategory = async (name: string, label: string) => {
    const { data, error } = await (supabase as any)
      .from("merchant_categories")
      .insert({ name: name.toLowerCase().replace(/\s+/g, "_"), label, sort_order: 500 })
      .select()
      .single();
    if (error) throw error;
    cachedCategories = null; // bust cache
    setCategories(prev => [...prev, data]);
    return data;
  };

  const getLabelForName = (name: string) => {
    const found = categories.find(c => c.name === name);
    return found?.label || name.replace(/_/g, " ");
  };

  return { categories, loading, addCategory, getLabelForName };
}
