import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GoldPriceData {
  price22k: number;
  price24k: number;
  updatedAt: string;
  loading: boolean;
  refresh: () => void;
}

const FALLBACK_22K = 16200;
const FALLBACK_24K = 19500;

export function useGoldPrice(): GoldPriceData {
  const [price22k, setPrice22k] = useState(FALLBACK_22K);
  const [price24k, setPrice24k] = useState(FALLBACK_24K);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPrice = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gold-price");
      if (error) throw error;
      if (data?.price22k) setPrice22k(data.price22k);
      if (data?.price24k) setPrice24k(data.price24k);
      if (data?.updatedAt) setUpdatedAt(data.updatedAt);
    } catch (err) {
      console.error("Failed to fetch gold price:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return { price22k, price24k, updatedAt, loading, refresh: fetchPrice };
}
