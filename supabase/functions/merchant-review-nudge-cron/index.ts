import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cron: nudges buyers 3 days after delivery to leave a review (idempotent per order).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const since = new Date(Date.now() - 4 * 86400000).toISOString();
  const until = new Date(Date.now() - 3 * 86400000).toISOString();

  const { data: orders, error } = await admin
    .from('orders')
    .select('id, merchant_id, user_id, status, updated_at, order_num')
    .eq('status', 'delivered')
    .gte('updated_at', since)
    .lte('updated_at', until)
    .not('user_id', 'is', null);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  let sent = 0;
  for (const o of orders || []) {
    const { data: existing } = await admin.from('merchant_review_nudges').select('id').eq('order_id', o.id).maybeSingle();
    if (existing) continue;
    const { error: nErr } = await admin.from('notifications').insert({
      user_id: o.user_id,
      title: '⭐ How was your order?',
      body: `Order #${o.order_num || o.id.slice(0, 8)} was delivered. Tap to rate & help other shoppers.`,
      type: 'review_request',
      metadata: { order_id: o.id, merchant_id: o.merchant_id },
    });
    if (nErr) continue;
    await admin.from('merchant_review_nudges').insert({
      order_id: o.id,
      merchant_id: o.merchant_id,
      user_id: o.user_id,
    });
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent, considered: orders?.length ?? 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
