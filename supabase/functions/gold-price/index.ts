import { corsHeaders } from '@supabase/supabase-js/cors'

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedData: { price22k: number; price24k: number; updatedAt: string } | null = null;
let cacheTime = 0;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const now = Date.now();
    if (cachedData && now - cacheTime < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cachedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch international gold price (XAU/USD) from goldprice.org public API
    const res = await fetch('https://data-asg.goldprice.org/dbXRates/USD', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!res.ok) {
      // Fallback to hardcoded BAJUS rates if API fails
      const fallback = { price22k: 16200, price24k: 19500, updatedAt: new Date().toISOString(), source: 'fallback' };
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    // data.items[0].xauPrice = price per troy ounce in USD
    const xauUsd = data?.items?.[0]?.xauPrice;

    if (!xauUsd || typeof xauUsd !== 'number') {
      const fallback = { price22k: 16200, price24k: 19500, updatedAt: new Date().toISOString(), source: 'fallback' };
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert troy ounce to gram: 1 troy ounce = 31.1035 grams
    const pricePerGramUsd24k = xauUsd / 31.1035;

    // USD to BDT rate (approximate current rate ~121 BDT/USD)
    // Fetch live rate
    let usdToBdt = 121;
    try {
      const fxRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=BDT');
      if (fxRes.ok) {
        const fxData = await fxRes.json();
        if (fxData?.rates?.BDT) usdToBdt = fxData.rates.BDT;
      }
    } catch {
      // Use fallback rate
    }

    const price24kPerGram = Math.round(pricePerGramUsd24k * usdToBdt);
    // 22K = 22/24 purity of 24K, plus ~3-5% making charges (BAJUS standard)
    const price22kPerGram = Math.round((pricePerGramUsd24k * (22 / 24)) * usdToBdt * 1.03);

    cachedData = {
      price22k: price22kPerGram,
      price24k: price24kPerGram,
      updatedAt: new Date().toISOString(),
    };
    cacheTime = now;

    return new Response(JSON.stringify(cachedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Gold price fetch error:', error);
    const fallback = { price22k: 16200, price24k: 19500, updatedAt: new Date().toISOString(), source: 'fallback' };
    return new Response(JSON.stringify(fallback), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
