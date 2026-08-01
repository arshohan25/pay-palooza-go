import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export interface FxCurrency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  mid_rate_bdt: number;
  spread_bps: number;
  is_active: boolean;
  sort_order: number;
  rate_source: string | null;
  updated_at: string;
}

export interface FxWallet {
  id: string;
  currency_code: string;
  balance: number;
}

export interface FxConversion {
  id: string;
  from_currency: string;
  to_currency: string;
  from_amount: number;
  to_amount: number;
  mid_rate: number;
  effective_rate: number;
  spread_bps: number;
  fee_amount: number;
  fee_currency: string;
  created_at: string;
}

export interface FxQuote {
  midRate: number;
  effectiveRate: number;
  spreadBps: number;
  receive: number;
  fee: number;
}

/** Client-side mirror of the fx_convert pricing so previews match the server. */
export function quoteFx(
  from: FxCurrency | undefined,
  to: FxCurrency | undefined,
  amount: number,
): FxQuote | null {
  if (!from || !to || !amount || amount <= 0 || from.code === to.code) return null;
  const mid = Number(from.mid_rate_bdt) / Number(to.mid_rate_bdt);
  const spreadBps = Math.max(from.spread_bps, to.spread_bps);
  const eff = mid * (1 - spreadBps / 10000);
  const round = (v: number) => Number(v.toFixed(to.decimals));
  const gross = round(amount * mid);
  const receive = round(amount * eff);
  return { midRate: mid, effectiveRate: eff, spreadBps, receive, fee: round(gross - receive) };
}

export function useFx() {
  const { user } = useAuth();
  const uid = user?.id;
  const [currencies, setCurrencies] = useState<FxCurrency[]>([]);
  const [wallets, setWallets] = useState<FxWallet[]>([]);
  const [conversions, setConversions] = useState<FxConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const reload = useCallback(async () => {
    const [cur, wal, conv] = await Promise.all([
      supabase.from("fx_currencies" as any).select("*").order("sort_order"),
      uid ? supabase.from("fx_wallets" as any).select("id,currency_code,balance").eq("user_id", uid) : Promise.resolve({ data: [] } as any),
      uid ? supabase.from("fx_conversions" as any).select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(25) : Promise.resolve({ data: [] } as any),
    ]);
    setCurrencies(((cur as any).data ?? []) as FxCurrency[]);
    setWallets(((wal as any).data ?? []) as FxWallet[]);
    setConversions(((conv as any).data ?? []) as FxConversion[]);
    setLoading(false);
  }, [uid]);

  useEffect(() => { reload(); }, [reload]);

  // Zero-refresh: rates and balances stream in live.
  useEffect(() => {
    const ch = supabase
      .channel("fx-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "fx_currencies" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "fx_wallets" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "fx_conversions" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  const convert = useCallback(async (from: string, to: string, amount: number) => {
    setConverting(true);
    try {
      const { data, error } = await supabase.rpc("fx_convert" as any, {
        p_from: from,
        p_to: to,
        p_amount: amount,
      });
      if (error) throw error;
      await reload();
      return data as any;
    } catch (e: any) {
      toast.error(e?.message ?? "Conversion failed");
      throw e;
    } finally {
      setConverting(false);
    }
  }, [reload]);

  const balanceOf = useCallback(
    (code: string) => Number(wallets.find((w) => w.currency_code === code)?.balance ?? 0),
    [wallets],
  );

  return { currencies, wallets, conversions, loading, converting, convert, balanceOf, reload };
}
