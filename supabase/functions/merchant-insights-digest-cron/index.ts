import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmt = (n: number) => new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(n);

// Weekly cron: pushes each merchant an insights digest (top product, best day, repeat rate).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const prevSince = new Date(Date.now() - 14 * 86400000).toISOString();

  const { data: merchants, error } = await admin
    .from('merchants')
    .select('id, user_id, business_name')
    .eq('is_active', true)
    .not('user_id', 'is', null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let sent = 0;

  for (const m of merchants || []) {
    const { data: items } = await admin
      .from('order_items')
      .select('subtotal, created_at, product_name')
      .eq('merchant_id', m.id)
      .gte('created_at', prevSince)
      .limit(3000);

    const rows = items || [];
    if (rows.length === 0) continue;

    const nowMs = Date.now();
    const weekMs = 7 * 86400000;
    let thisRev = 0;
    let lastRev = 0;
    const productTotals = new Map<string, number>();
    const dayCounts = new Array(7).fill(0);

    for (const r of rows) {
      const ts = new Date(r.created_at as string).getTime();
      const rev = Number(r.subtotal || 0);
      if (nowMs - ts < weekMs) {
        thisRev += rev;
        if (r.product_name) {
          productTotals.set(r.product_name as string, (productTotals.get(r.product_name as string) || 0) + rev);
        }
        dayCounts[new Date(r.created_at as string).getDay()] += 1;
      } else {
        lastRev += rev;
      }
    }

    if (thisRev === 0 && lastRev === 0) continue;

    const delta = lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : (thisRev > 0 ? 100 : 0);
    const topProduct = [...productTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const bestIdx = dayCounts.indexOf(Math.max(...dayCounts));
    const bestDay = dayCounts[bestIdx] > 0 ? DOW[bestIdx] : null;

    // Repeat-customer rate over the last 7 days of orders
    const { data: orders } = await admin
      .from('orders')
      .select('user_id')
      .eq('merchant_id', m.id)
      .gte('created_at', since)
      .limit(2000);

    const counts = new Map<string, number>();
    for (const o of orders || []) {
      if (!o.user_id) continue;
      counts.set(o.user_id as string, (counts.get(o.user_id as string) || 0) + 1);
    }
    const buyers = counts.size;
    const repeaters = [...counts.values()].filter((c) => c > 1).length;
    const repeatRate = buyers > 0 ? Math.round((repeaters / buyers) * 100) : 0;

    const parts = [
      `৳${fmt(thisRev)} this week (${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% vs last week).`,
      topProduct ? `Top seller: ${topProduct}.` : null,
      bestDay ? `Busiest day: ${bestDay}.` : null,
      buyers > 0 ? `Repeat customers: ${repeatRate}%.` : null,
    ].filter(Boolean);

    const { error: nErr } = await admin.from('notifications').insert({
      user_id: m.user_id,
      title: '📊 Your weekly insights',
      body: parts.join(' '),
      type: 'merchant_insights',
      metadata: {
        merchant_id: m.id,
        revenue_this_week: thisRev,
        revenue_last_week: lastRev,
        delta_pct: Number(delta.toFixed(1)),
        top_product: topProduct,
        best_day: bestDay,
        repeat_rate_pct: repeatRate,
      },
    });
    if (!nErr) sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent, merchants: merchants?.length ?? 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
