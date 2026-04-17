// Live DSE (Dhaka Stock Exchange) price fetcher.
// Scrapes the public DSE Latest Share Price page and falls back to indicative
// prices if the upstream is unreachable. 5-minute server-side cache.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_MS = 5 * 60 * 1000;

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number; // percent
  sector: string;
}

// Curated halal-screened DSE tickers shown in the app.
const TICKERS: Array<{ symbol: string; name: string; sector: string; fallback: number }> = [
  { symbol: 'GP',     name: 'Grameenphone',      sector: 'Telecom',  fallback: 385.50 },
  { symbol: 'SQURPHARMA', name: 'Square Pharma', sector: 'Pharma',   fallback: 218.30 },
  { symbol: 'BRACBANK', name: 'BRAC Bank',       sector: 'Banking',  fallback: 42.10 },
  { symbol: 'BATBC',   name: 'BAT Bangladesh',   sector: 'FMCG',     fallback: 550.00 },
  { symbol: 'LHBL',    name: 'LafargeHolcim BD', sector: 'Cement',   fallback: 68.90 },
  { symbol: 'RENATA',  name: 'Renata Pharma',    sector: 'Pharma',   fallback: 1320.00 },
  { symbol: 'ISLAMIBANK', name: 'Islami Bank BD', sector: 'Banking', fallback: 28.50 },
  { symbol: 'WALTONHIL', name: 'Walton Hi-Tech', sector: 'Tech',     fallback: 1250.00 },
];

// App-side display symbols (kept stable so existing holdings still match).
const DISPLAY_SYMBOL: Record<string, string> = {
  GP: 'GRPH',
  SQURPHARMA: 'SQPH',
  BRACBANK: 'BRAC',
  BATBC: 'BATB',
  LHBL: 'LHBL',
  RENATA: 'RENP',
  ISLAMIBANK: 'ISLB',
  WALTONHIL: 'WALP',
};

let cache: { data: { stocks: StockQuote[]; updatedAt: string; source: string }; t: number } | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const now = Date.now();
  if (cache && now - cache.t < CACHE_TTL_MS) {
    return json(cache.data);
  }

  try {
    const res = await fetch('https://www.dsebd.org/latest_share_price_scroll_l.php', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EasyPay/1.0)' },
    });

    if (!res.ok) return json(fallback('upstream_error'));

    const html = await res.text();
    const parsed = parseDseTable(html);

    const stocks: StockQuote[] = TICKERS.map((t) => {
      const row = parsed.get(t.symbol.toUpperCase());
      const price = row?.price && row.price > 0 ? row.price : t.fallback;
      const change = typeof row?.changePct === 'number' ? row.changePct : 0;
      return {
        symbol: DISPLAY_SYMBOL[t.symbol] ?? t.symbol,
        name: t.name,
        sector: t.sector,
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
      };
    });

    const matched = stocks.filter((s) => s.price !== TICKERS.find((t) => DISPLAY_SYMBOL[t.symbol] === s.symbol || t.symbol === s.symbol)?.fallback).length;

    const data = {
      stocks,
      updatedAt: new Date().toISOString(),
      source: matched > 0 ? 'dse_live' : 'fallback',
    };
    cache = { data, t: now };
    return json(data);
  } catch (err) {
    console.error('stock-price error', err);
    return json(fallback('exception'));
  }
});

function fallback(source: string) {
  return {
    stocks: TICKERS.map((t) => ({
      symbol: DISPLAY_SYMBOL[t.symbol] ?? t.symbol,
      name: t.name,
      sector: t.sector,
      price: t.fallback,
      change: 0,
    })),
    updatedAt: new Date().toISOString(),
    source,
  };
}

// Very small HTML table parser tuned for the DSE latest-price page.
// The page contains rows like <tr><td>...</td><td>SYMBOL</td><td>LTP</td>...<td>Change%</td>...</tr>
function parseDseTable(html: string): Map<string, { price: number; changePct: number }> {
  const out = new Map<string, { price: number; changePct: number }>();
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    let c: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((c = cellRe.exec(m[1])) !== null) {
      cells.push(stripTags(c[1]).trim());
    }
    if (cells.length < 4) continue;
    // Expected layout (varies): [#, SYMBOL, LTP, HIGH, LOW, CLOSEP, YCP, CHANGE, TRADE, VALUE, VOLUME]
    const symbol = cells[1]?.toUpperCase();
    const ltp = parseFloat(cells[2]);
    // change column may be cells[7] (absolute) — derive % from YCP if available
    const ycp = parseFloat(cells[6]);
    if (!symbol || !isFinite(ltp) || ltp <= 0) continue;
    const changePct = isFinite(ycp) && ycp > 0 ? ((ltp - ycp) / ycp) * 100 : 0;
    out.set(symbol, { price: ltp, changePct });
  }
  return out;
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
