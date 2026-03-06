import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SavedBankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  short_code: string;
  created_at: string;
}

export function useSavedBanks() {
  const [accounts, setAccounts] = useState<SavedBankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setAccounts([]); setLoading(false); return; }

    const { data } = await supabase
      .from("saved_bank_accounts")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    setAccounts((data as SavedBankAccount[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      channel = supabase
        .channel("saved-banks-realtime")
        .on("postgres_changes", {
          event: "*", schema: "public", table: "saved_bank_accounts",
          filter: `user_id=eq.${session.user.id}`,
        }, () => { fetch(); })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [fetch]);

  const save = useCallback(async (params: {
    bank_name: string;
    account_number: string;
    account_holder: string;
    short_code: string;
  }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from("saved_bank_accounts").upsert(
      {
        user_id: session.user.id,
        bank_name: params.bank_name,
        account_number: params.account_number,
        account_holder: params.account_holder,
        short_code: params.short_code,
      },
      { onConflict: "user_id,bank_name,account_number" }
    );
    fetch();
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("saved_bank_accounts").delete().eq("id", id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { accounts, loading, save, remove, refetch: fetch };
}
