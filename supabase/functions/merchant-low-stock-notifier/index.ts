import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cron: notifies merchant owners when a product hits its low-stock threshold or
// runs out. Idempotent — one open alert row per (product, level); alerts are
// resolved automatically once stock recovers above the threshold.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: products, error } = await admin
    .from('merchant_products')
    .select('id, merchant_id, name, stock, low_stock_threshold, is_active')
    .eq('is_active', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  const { data: openAlerts } = await admin
    .from('product_stock_alerts')
    .select('id, product_id, level')
    .is('resolved_at', null);

  const openKey = new Set((openAlerts || []).map((a) => `${a.product_id}:${a.level}`));
  const ownerCache = new Map<string, string | null>();

  const ownerOf = async (merchantId: string) => {
    if (ownerCache.has(merchantId)) return ownerCache.get(merchantId)!;
    const { data } = await admin.from('merchants').select('user_id').eq('id', merchantId).maybeSingle();
    const uid = data?.user_id ?? null;
    ownerCache.set(merchantId, uid);
    return uid;
  };

  let notified = 0;
  const resolveIds: string[] = [];

  for (const p of products || []) {
    const threshold = p.low_stock_threshold ?? 5;
    const level = p.stock <= 0 ? 'out' : p.stock <= threshold ? 'low' : null;

    // Resolve alerts that no longer apply.
    for (const a of openAlerts || []) {
      if (a.product_id !== p.id) continue;
      if (a.level !== level) resolveIds.push(a.id);
    }

    if (!level) continue;
    if (openKey.has(`${p.id}:${level}`)) continue;

    const userId = await ownerOf(p.merchant_id);
    if (!userId) continue;

    const { error: nErr } = await admin.from('notifications').insert({
      user_id: userId,
      title: level === 'out' ? '🚫 Out of stock' : '⚠️ Low stock',
      body: level === 'out'
        ? `"${p.name}" is out of stock. Restock to keep selling.`
        : `"${p.name}" has only ${p.stock} left (alert at ${threshold}).`,
      type: 'merchant_low_stock',
      metadata: { product_id: p.id, merchant_id: p.merchant_id, stock: p.stock, level },
    });
    if (nErr) continue;

    await admin.from('product_stock_alerts').insert({
      merchant_id: p.merchant_id,
      product_id: p.id,
      level,
      stock_at_alert: p.stock,
      threshold_at_alert: threshold,
    });
    notified++;
  }

  if (resolveIds.length > 0) {
    await admin
      .from('product_stock_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .in('id', resolveIds);
  }

  return new Response(
    JSON.stringify({ ok: true, notified, resolved: resolveIds.length, scanned: products?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
