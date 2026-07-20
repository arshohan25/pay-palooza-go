import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
    const uid = claims.claims.sub as string;

    const { merchantId, title, message, audience, channel } = await req.json();
    if (!merchantId || !title || !message || !audience) {
      return json({ error: 'Missing fields' }, 400);
    }
    if (title.length > 120 || message.length > 500) {
      return json({ error: 'title ≤120 chars, message ≤500' }, 400);
    }
    if (!['all', 'recent_30d', 'inactive_60d', 'gold_silver'].includes(audience)) {
      return json({ error: 'Bad audience' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify ownership
    const { data: mrc } = await admin.from('merchants').select('id, business_name, user_id').eq('id', merchantId).single();
    if (!mrc || mrc.user_id !== uid) return json({ error: 'Forbidden' }, 403);

    // Rate limit: max 5 broadcasts/day
    const { count: todayCount } = await admin
      .from('merchant_broadcasts')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
    if ((todayCount ?? 0) >= 5) {
      return json({ error: 'Daily broadcast limit (5) reached' }, 429);
    }

    // Build audience
    let userIds: string[] = [];
    if (audience === 'all') {
      const { data } = await admin.from('orders').select('buyer_user_id').eq('merchant_id', merchantId).not('buyer_user_id', 'is', null);
      userIds = [...new Set((data || []).map((r: any) => r.buyer_user_id))];
    } else if (audience === 'recent_30d') {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await admin.from('orders').select('buyer_user_id').eq('merchant_id', merchantId).gte('created_at', since).not('buyer_user_id', 'is', null);
      userIds = [...new Set((data || []).map((r: any) => r.buyer_user_id))];
    } else if (audience === 'inactive_60d') {
      const { data } = await admin.from('orders').select('buyer_user_id, created_at').eq('merchant_id', merchantId).not('buyer_user_id', 'is', null);
      const cut = Date.now() - 60 * 86400000;
      const lastMap: Record<string, number> = {};
      for (const r of data || []) {
        const t = new Date(r.created_at).getTime();
        if (!lastMap[r.buyer_user_id] || t > lastMap[r.buyer_user_id]) lastMap[r.buyer_user_id] = t;
      }
      userIds = Object.entries(lastMap).filter(([, t]) => t < cut).map(([u]) => u);
    } else if (audience === 'gold_silver') {
      const { data: orders } = await admin.from('orders').select('buyer_user_id').eq('merchant_id', merchantId).not('buyer_user_id', 'is', null);
      const buyers = [...new Set((orders || []).map((r: any) => r.buyer_user_id))];
      if (buyers.length) {
        const { data: loy } = await admin.from('user_loyalty').select('user_id, tier_name').in('user_id', buyers);
        userIds = (loy || []).filter((r: any) => ['Gold', 'Silver', 'Signature', 'Premier'].includes(r.tier_name)).map((r: any) => r.user_id);
      }
    }

    if (!userIds.length) return json({ error: 'No recipients matched' }, 400);

    const { data: bc, error: bcErr } = await admin
      .from('merchant_broadcasts')
      .insert({
        merchant_id: merchantId,
        created_by: uid,
        title,
        message,
        audience,
        channel: channel === 'inapp_sms' ? 'inapp_sms' : 'inapp',
        status: 'sending',
        recipients_count: userIds.length,
      })
      .select()
      .single();
    if (bcErr || !bc) return json({ error: bcErr?.message || 'insert failed' }, 500);

    // Insert notifications in chunks
    const chunk = 500;
    let delivered = 0;
    let failed = 0;
    for (let i = 0; i < userIds.length; i += chunk) {
      const slice = userIds.slice(i, i + chunk);
      const rows = slice.map((u) => ({
        user_id: u,
        title: `📣 ${mrc.business_name}: ${title}`,
        body: message,
        type: 'merchant_broadcast',
        metadata: { broadcast_id: bc.id, merchant_id: merchantId },
      }));
      const { error: nErr } = await admin.from('notifications').insert(rows);
      if (nErr) {
        failed += slice.length;
      } else {
        delivered += slice.length;
        await admin.from('merchant_broadcast_recipients').insert(
          slice.map((u) => ({ broadcast_id: bc.id, user_id: u, status: 'delivered' })),
        );
      }
    }

    await admin
      .from('merchant_broadcasts')
      .update({ status: failed === userIds.length ? 'failed' : 'sent', delivered_count: delivered, failed_count: failed, sent_at: new Date().toISOString() })
      .eq('id', bc.id);

    return json({ ok: true, broadcast_id: bc.id, delivered, failed, total: userIds.length });
  } catch (e: any) {
    return json({ error: e?.message || 'server error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
