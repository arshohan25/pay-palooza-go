import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authorize: shared cron secret OR admin JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronSecret = Deno.env.get("FRAUD_RULES_SECRET");
  let authorized = false;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true;
  } else if (authHeader.startsWith("Bearer ")) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: c } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (c?.claims?.sub) {
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: roleCheck } = await admin
          .from("user_roles")
          .select("id")
          .eq("user_id", c.claims.sub as string)
          .in("role", ["admin", "risk", "compliance"])
          .maybeSingle();
        if (roleCheck) authorized = true;
      }
    } catch { /* noop */ }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch active auto-rules
    const { data: rules, error: rulesErr } = await supabase
      .from("fraud_auto_rules")
      .select("*")
      .eq("is_active", true);
    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: "No active rules", triggered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let triggered = 0;

    for (const rule of rules) {
      let userMetrics: { user_id: string; value: number }[] = [];

      if (rule.metric === "daily_txn_count") {
        const { data } = await supabase
          .from("transactions")
          .select("user_id")
          .gte("created_at", dayAgo)
          .eq("status", "completed");
        const counts: Record<string, number> = {};
        (data ?? []).forEach((t: any) => { counts[t.user_id] = (counts[t.user_id] || 0) + 1; });
        userMetrics = Object.entries(counts).map(([user_id, value]) => ({ user_id, value }));

      } else if (rule.metric === "weekly_volume") {
        const { data } = await supabase
          .from("transactions")
          .select("user_id, amount")
          .gte("created_at", weekAgo)
          .eq("status", "completed");
        const volumes: Record<string, number> = {};
        (data ?? []).forEach((t: any) => { volumes[t.user_id] = (volumes[t.user_id] || 0) + Number(t.amount); });
        userMetrics = Object.entries(volumes).map(([user_id, value]) => ({ user_id, value }));

      } else if (rule.metric === "daily_recipients") {
        const { data } = await supabase
          .from("transactions")
          .select("user_id, recipient_phone")
          .gte("created_at", dayAgo)
          .eq("status", "completed")
          .not("recipient_phone", "is", null);
        const recipients: Record<string, Set<string>> = {};
        (data ?? []).forEach((t: any) => {
          if (!recipients[t.user_id]) recipients[t.user_id] = new Set();
          recipients[t.user_id].add(t.recipient_phone);
        });
        userMetrics = Object.entries(recipients).map(([user_id, s]) => ({ user_id, value: s.size }));

      } else if (rule.metric === "failed_pin_attempts") {
        const { data } = await supabase
          .from("audit_logs")
          .select("actor_id")
          .in("action", ["pin_failed", "failed_pin_attempt"])
          .gte("created_at", dayAgo);
        const counts: Record<string, number> = {};
        (data ?? []).forEach((l: any) => { counts[l.actor_id] = (counts[l.actor_id] || 0) + 1; });
        userMetrics = Object.entries(counts).map(([user_id, value]) => ({ user_id, value }));

      } else if (rule.metric === "device_count") {
        const { data } = await supabase
          .from("device_registrations")
          .select("user_id, device_fingerprint");
        const devices: Record<string, Set<string>> = {};
        (data ?? []).forEach((d: any) => {
          if (!devices[d.user_id]) devices[d.user_id] = new Set();
          devices[d.user_id].add(d.device_fingerprint);
        });
        userMetrics = Object.entries(devices).map(([user_id, s]) => ({ user_id, value: s.size }));
      }

      // Check breaches
      const breached = userMetrics.filter(m => m.value > Number(rule.threshold));

      for (const breach of breached) {
        // Check if already logged for this rule+user in last 24h to avoid duplicates
        const { data: existing } = await supabase
          .from("fraud_auto_rule_logs")
          .select("id")
          .eq("rule_id", rule.id)
          .eq("user_id", breach.user_id)
          .gte("created_at", dayAgo)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Execute action
        if (rule.action === "lock_account" || rule.action === "lock_send_money") {
          const feature = rule.action === "lock_send_money" ? "send_money" : "account";
          await supabase.from("feature_locks").insert({
            target_user_id: breach.user_id,
            feature,
            reason: `Auto-rule "${rule.name}": ${rule.metric} = ${breach.value} (threshold: ${rule.threshold})`,
            locked_by: "00000000-0000-0000-0000-000000000000", // system
          });
        }

        // Create fraud alert
        await supabase.from("fraud_alerts").insert({
          user_id: breach.user_id,
          rule_triggered: `auto_rule: ${rule.name}`,
          severity: breach.value > Number(rule.threshold) * 2 ? "critical" : "high",
          status: "open",
          details: {
            auto_rule_id: rule.id,
            metric: rule.metric,
            metric_value: breach.value,
            threshold: rule.threshold,
            action: rule.action,
          },
        });

        // Log the action
        await supabase.from("fraud_auto_rule_logs").insert({
          rule_id: rule.id,
          user_id: breach.user_id,
          metric_value: breach.value,
          action_taken: rule.action,
        });

        // Send admin notification
        await supabase.from("admin_notifications").insert({
          admin_id: "00000000-0000-0000-0000-000000000000",
          title: `🚨 Auto-Rule Triggered: ${rule.name}`,
          body: `User ${breach.user_id.slice(0, 8)}… breached ${rule.metric} threshold (${breach.value} > ${rule.threshold}). Action: ${rule.action}`,
          category: "fraud",
        });

        triggered++;
      }
    }

    return new Response(JSON.stringify({ triggered, rules_evaluated: rules.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
