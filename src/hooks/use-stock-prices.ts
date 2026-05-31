import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LiveStock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
}

const FALLBACK: LiveStock[] = [
  { symbol: "GRPH", name: "Grameenphone",     sector: "Telecom", price: 385.50, change: 0 },
  { symbol: "SQPH", name: "Square Pharma",    sector: "Pharma",  price: 218.30, change: 0 },
  { symbol: "BRAC", name: "BRAC Bank",        sector: "Banking", price: 42.10,  change: 0 },
  { symbol: "BATB", name: "BAT Bangladesh",   sector: "FMCG",    price: 550.00, change: 0 },
  { symbol: "LHBL", name: "LafargeHolcim BD", sector: "Cement",  price: 68.90,  change: 0 },
  { symbol: "RENP", name: "Renata Pharma",    sector: "Pharma",  price: 1320.00, change: 0 },
  { symbol: "ISLB", name: "Islami Bank BD",   sector: "Banking", price: 28.50,  change: 0 },
  { symbol: "WALP", name: "Walton Hi-Tech",   sector: "Tech",    price: 1250.00, change: 0 },
];

export function useStockPrices() {
  const [stocks, setStocks] = useState<LiveStock[]>(FALLBACK);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [source, setSource] = useState<string>("fallback");
  const [loading, setLoading] = useState(true);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stock-price");
      if (error) throw error;
      if (Array.isArray(data?.stocks) && data.stocks.length > 0) {
        setStocks(data.stocks);
      }
      if (data?.updatedAt) setUpdatedAt(data.updatedAt);
      if (data?.source) setSource(data.source);
    } catch (err) {
      console.error("stock-price fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  return { stocks, updatedAt, source, loading, refresh: fetchPrices };
}
