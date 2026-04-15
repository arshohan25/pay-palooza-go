const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedData: { price22k: number; price24k: number; updatedAt: string } | null = null;
let cacheTime = 0;

const FALLBACK = { price22k: 16200, price24k: 19500 };

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

    // Fetch live gold spot price from Swissquote (free, no API key needed)
    const res = await fetch(
      'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD',
      { headers: { 'Accept': 'application/json' } }
    );

    if (!res.ok) {
      return respond({ ...FALLBACK, updatedAt: new Date().toISOString(), source: 'fallback' });
    }

    const data = await res.json();
    const standardProfile = data?.[0]?.spreadProfilePrices?.find(
      (p: { spreadProfile: string }) => p.spreadProfile === 'standard'
    );
    const xauUsd = standardProfile
      ? (standardProfile.bid + standardProfile.ask) / 2
      : null;

    if (!xauUsd || typeof xauUsd !== 'number' || xauUsd < 100) {
      return respond({ ...FALLBACK, updatedAt: new Date().toISOString(), source: 'fallback' });
    }

    // Convert troy ounce to gram: 1 troy ounce = 31.1035 grams
    const pricePerGramUsd24k = xauUsd / 31.1035;

    // Fetch USD/BDT exchange rate
    let usdToBdt = 121; // fallback
    try {
      const fxRes = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=BDT');
      if (fxRes.ok) {
        const fxData = await fxRes.json();
        if (fxData?.rates?.BDT) usdToBdt = fxData.rates.BDT;
      }
    } catch {
      // Use fallback rate
    }

    const price24kPerGram = Math.round(pricePerGramUsd24k * usdToBdt);
    // 22K = 22/24 purity with ~3% BAJUS making charge
    const price22kPerGram = Math.round((pricePerGramUsd24k * (22 / 24)) * usdToBdt * 1.03);

    cachedData = {
      price22k: price22kPerGram,
      price24k: price24kPerGram,
      updatedAt: new Date().toISOString(),
    };
    cacheTime = now;

    return respond(cachedData);
  } catch (error) {
    console.error('Gold price fetch error:', error);
    return respond({ ...FALLBACK, updatedAt: new Date().toISOString(), source: 'fallback' });
  }
});

function respond(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
