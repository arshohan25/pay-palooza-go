/**
 * Reactive balance store backed by Supabase profiles table.
 * Components subscribe via `onBalanceChange`; flows call `deductBalance` / `addBalance`.
 * Falls back to a local cache until the DB balance is loaded.
 */

import { supabase } from "@/integrations/supabase/client";

let balance = 0;
let loaded = false;
const listeners = new Set<(b: number) => void>();

const notify = () => listeners.forEach((fn) => fn(balance));

export const getBalance = () => balance;
export const isBalanceLoaded = () => loaded;

/** Fetch the real balance from DB for the current user */
export async function fetchBalance(): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return balance;

  const { data, error } = await supabase
    .from("profiles")
    .select("balance")
    .eq("user_id", session.user.id)
    .single();

  if (data && !error) {
    balance = parseFloat(String(data.balance));
    loaded = true;
    notify();
  }
  return balance;
}

/** Update balance in DB and locally */
async function updateDbBalance(newBalance: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  balance = Math.max(0, newBalance);
  notify(); // optimistic local update

  await supabase
    .from("profiles")
    .update({ balance })
    .eq("user_id", session.user.id);
}

export const deductBalance = async (amount: number) => {
  await updateDbBalance(balance - amount);
};

export const addBalance = async (amount: number) => {
  await updateDbBalance(balance + amount);
};

export const onBalanceChange = (fn: (b: number) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Subscribe to realtime balance changes from the DB */
let realtimeSetup = false;
export function setupBalanceRealtime() {
  if (realtimeSetup) return;
  realtimeSetup = true;

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.user) return;
    supabase
      .channel("balance-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const newBal = parseFloat(String(payload.new.balance));
          if (!isNaN(newBal) && newBal !== balance) {
            balance = newBal;
            notify();
          }
        }
      )
      .subscribe();
  });
}

/** Transfer money to another user atomically via DB function */
export async function transferMoney(params: {
  recipientPhone: string;
  amount: number;
  fee?: number;
  type?: "send" | "payment" | "cashout";
  description?: string;
  reference?: string;
  recipientName?: string;
  recipientType?: "receive" | "cashout" | "cashin";
  commission?: number;
}): Promise<{ success: boolean; recipientFound: boolean; senderBalance: number }> {
  const { data, error } = await supabase.rpc("transfer_money", {
    p_recipient_phone: params.recipientPhone,
    p_amount: params.amount,
    p_fee: params.fee ?? 0,
    p_type: params.type ?? "send",
    p_description: params.description ?? null,
    p_reference: params.reference ?? null,
    p_recipient_name: params.recipientName ?? null,
    p_recipient_type: params.recipientType ?? "receive",
    p_commission: params.commission ?? 0,
  });

  if (error) throw error;

  const result = typeof data === "string" ? JSON.parse(data) : data;
  // Update local balance from the DB response
  balance = result.sender_balance;
  notify();

  return {
    success: result.success,
    recipientFound: result.recipient_found,
    senderBalance: result.sender_balance,
  };
}

/** Record a transaction in the DB and update balance atomically via server-side RPC */
export async function recordTransaction(params: {
  type: "send" | "cashout" | "banktransfer" | "payment" | "recharge" | "paybill" | "addmoney";
  amount: number;
  fee?: number;
  recipientPhone?: string;
  recipientName?: string;
  description?: string;
  reference?: string;
}): Promise<void> {
  const { data, error } = await supabase.rpc("record_transaction", {
    p_type: params.type,
    p_amount: params.amount,
    p_fee: params.fee ?? 0,
    p_recipient_phone: params.recipientPhone ?? null,
    p_recipient_name: params.recipientName ?? null,
    p_description: params.description ?? null,
    p_reference: params.reference ?? null,
  });

  if (error) throw error;

  const result = typeof data === "string" ? JSON.parse(data) : data;
  balance = result.balance;
  notify();
}
