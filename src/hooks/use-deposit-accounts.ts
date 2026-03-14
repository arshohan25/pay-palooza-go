import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DepositAccount {
  id: string;
  method: string;
  label: string;
  account_number: string;
  account_name: string | null;
  bank_name: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useDepositAccounts(method?: string) {
  const [accounts, setAccounts] = useState<DepositAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("deposit_accounts" as any).select("*").order("sort_order");
    if (method) q = q.eq("method", method);
    const { data, error } = await q;
    if (!error) setAccounts((data as any[]) ?? []);
    setLoading(false);
  }, [method]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = async (account: Partial<DepositAccount> & { method: string; label: string; account_number: string }) => {
    const { error } = await supabase.from("deposit_accounts" as any).upsert({ ...account, updated_at: new Date().toISOString() } as any);
    if (error) { toast.error(error.message); throw error; }
    toast.success("Deposit account saved");
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("deposit_accounts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    toast.success("Deposit account deleted");
    await fetch();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("deposit_accounts" as any).update({ is_active, updated_at: new Date().toISOString() } as any).eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    await fetch();
  };

  return { accounts, loading, refetch: fetch, upsert, remove, toggleActive };
}
