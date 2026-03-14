import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FundRequest {
  id: string;
  user_id: string;
  type: "add_money" | "withdraw";
  amount: number;
  status: "pending" | "approved" | "rejected";
  source_method: string | null;
  proof_url: string | null;
  transaction_id_proof: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useFundRequests() {
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from("fund_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRequests((data as FundRequest[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
    const ch = supabase
      .channel("fund-requests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchRequests]);

  const submitRequest = async (params: {
    type: "add_money" | "withdraw";
    amount: number;
    source_method?: string;
    proof_url?: string;
    transaction_id_proof?: string;
    bank_name?: string;
    account_number?: string;
    account_holder?: string;
  }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Not authenticated");

    const { error } = await supabase.from("fund_requests").insert({
      user_id: session.user.id,
      type: params.type,
      amount: params.amount,
      source_method: params.source_method ?? null,
      proof_url: params.proof_url ?? null,
      transaction_id_proof: params.transaction_id_proof ?? null,
      bank_name: params.bank_name ?? null,
      account_number: params.account_number ?? null,
      account_holder: params.account_holder ?? null,
    });
    if (error) throw error;
  };

  const submitWithdraw = async (params: {
    amount: number;
    bank_name: string;
    account_number: string;
    account_holder: string;
  }) => {
    const { data, error } = await supabase.rpc("submit_withdraw_request", {
      p_amount: params.amount,
      p_bank_name: params.bank_name,
      p_account_number: params.account_number,
      p_account_holder: params.account_holder,
    });
    if (error) throw error;
    return data as { success: boolean; amount: number; fee: number; total_deducted: number; new_balance: number };
  };

  const uploadProof = async (file: File): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Not authenticated");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${session.user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("fund-proofs").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("fund-proofs").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return { requests, loading, submitRequest, uploadProof, pendingCount, refresh: fetchRequests };
}
