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

/** Record a transaction in the DB and update balance */
export async function recordTransaction(params: {
  type: "send" | "cashout" | "payment" | "recharge" | "paybill" | "addmoney";
  amount: number;
  fee?: number;
  recipientPhone?: string;
  recipientName?: string;
  description?: string;
  reference?: string;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const fee = params.fee ?? 0;
  const totalDeduction = params.type === "addmoney" ? 0 : params.amount + fee;
  const newBalance = params.type === "addmoney"
    ? balance + params.amount
    : balance - totalDeduction;

  // Update balance
  balance = Math.max(0, newBalance);
  notify();

  await supabase
    .from("profiles")
    .update({ balance })
    .eq("user_id", session.user.id);

  // Insert transaction record
  await supabase.from("transactions").insert({
    user_id: session.user.id,
    type: params.type,
    amount: params.amount,
    fee,
    balance_after: balance,
    recipient_phone: params.recipientPhone ?? null,
    recipient_name: params.recipientName ?? null,
    description: params.description ?? null,
    reference: params.reference ?? null,
    status: "completed",
  });
}
