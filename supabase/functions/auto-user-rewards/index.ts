import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Restrict to cron/admin invocations via shared secret OR admin JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronSecret = Deno.env.get("AUTO_REWARDS_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
          .eq("role", "admin")
          .maybeSingle();
        if (roleCheck) authorized = true;
      }
    } catch { /* fall through */ }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch all users with profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, phone, status, created_at, balance, kyc_status")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No users to analyze", applied: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch transaction data for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTxns } = await supabase
      .from("transactions")
      .select("user_id, type, amount, status, created_at")
      .gte("created_at", thirtyDaysAgo)
      .eq("status", "completed")
      .limit(1000);

    // 3. Build per-user activity
    const userActivity: Record<string, {
      txn_count: number;
      total_volume: number;
      types: Set<string>;
      last_txn: string;
      add_money_total: number;
      payment_total: number;
      send_total: number;
    }> = {};

    (recentTxns || []).forEach((t: any) => {
      if (!userActivity[t.user_id]) {
        userActivity[t.user_id] = {
          txn_count: 0, total_volume: 0, types: new Set(),
          last_txn: t.created_at, add_money_total: 0, payment_total: 0, send_total: 0,
        };
      }
      const u = userActivity[t.user_id];
      u.txn_count++;
      u.total_volume += Number(t.amount);
      u.types.add(t.type);
      if (t.created_at > u.last_txn) u.last_txn = t.created_at;
      if (t.type === "addmoney") u.add_money_total += Number(t.amount);
      if (t.type === "payment") u.payment_total += Number(t.amount);
      if (t.type === "send") u.send_total += Number(t.amount);
    });

    // 4. Check existing active rewards to avoid duplicates
    const { data: existingRewards } = await supabase
      .from("ai_auto_rewards")
      .select("user_id, reward_type, title")
      .eq("status", "active");

    const existingSet = new Set(
      (existingRewards || []).map((r: any) => `${r.user_id}:${r.reward_type}:${r.title}`)
    );

    // 5. Categorize users and generate rewards
    const now = Date.now();
    const rewardsToInsert: any[] = [];
    const expiresIn7Days = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    const expiresIn14Days = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
    const expiresIn30Days = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const p of profiles) {
      const activity = userActivity[p.id];
      const accountAgeDays = Math.floor((now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceLastTxn = activity?.last_txn
        ? Math.floor((now - new Date(activity.last_txn).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let segment = "new";
      if (accountAgeDays <= 7) segment = "new";
      else if (activity?.txn_count >= 20 && activity?.total_volume >= 50000) segment = "power";
      else if (activity?.txn_count >= 5) segment = "active";
      else if (daysSinceLastTxn > 30 && daysSinceLastTxn < 90) segment = "inactive";
      else if (daysSinceLastTxn >= 90) segment = "comeback";
      else segment = "declining";

      const addReward = (type: string, title: string, desc: string, details: any, expires: string) => {
        const key = `${p.id}:${type}:${title}`;
        if (!existingSet.has(key)) {
          existingSet.add(key);
          rewardsToInsert.push({
            user_id: p.id,
            reward_type: type,
            title,
            description: desc,
            details,
            segment,
            expires_at: expires,
            status: "active",
          });
        }
      };

      // NEW USER rewards
      if (segment === "new") {
        addReward("coupon", "🎉 Welcome Bonus", "Get ৳20 cashback on your first transaction!",
          { discount_type: "fixed", discount_value: 20, min_txn: 50 }, expiresIn14Days);
        addReward("offer", "🚀 First Steps Bonus", "Complete 3 transactions to unlock ৳50 reward",
          { target_txn_count: 3, reward_amount: 50 }, expiresIn30Days);
      }

      // POWER USER rewards
      if (segment === "power") {
        addReward("coupon", "⭐ VIP Cashback", "Exclusive 5% cashback on all payments (max ৳200)",
          { discount_type: "percentage", discount_value: 5, max_discount: 200 }, expiresIn30Days);

        // Loan pre-approval for power users
        if (accountAgeDays >= 30 && (activity?.txn_count || 0) >= 15 && (activity?.add_money_total || 0) >= 5000) {
          const loanAmount = Math.min(Math.floor((activity?.total_volume || 0) * 0.3), 50000);
          addReward("loan", "💰 Loan Pre-Approved", `You're pre-approved for up to ৳${loanAmount.toLocaleString()}!`,
            { max_amount: loanAmount, interest_rate: 8, max_tenure: 12 }, expiresIn30Days);
        }

        addReward("gift_card", "🎁 Loyalty Gift", "Claim a ৳100 gift card as our appreciation",
          { denomination: 100, brand: "EasyPay" }, expiresIn14Days);
      }

      // ACTIVE USER rewards
      if (segment === "active") {
        // Encourage unused features
        if (!activity?.types.has("payment")) {
          addReward("coupon", "🛍️ Try Payments", "Get 10% off your first payment (max ৳50)",
            { discount_type: "percentage", discount_value: 10, max_discount: 50, target_txn_type: "payment" }, expiresIn14Days);
        }
        if (!activity?.types.has("recharge")) {
          addReward("offer", "📱 Free Recharge Bonus", "Recharge & get ৳10 instant cashback",
            { cashback: 10, target_txn_type: "recharge" }, expiresIn14Days);
        }
        // Loan teaser
        if (accountAgeDays >= 30 && (activity?.txn_count || 0) >= 10) {
          addReward("loan", "📊 Loan Available", "Your transaction history qualifies you for a micro-loan!",
            { max_amount: 5000, interest_rate: 10, max_tenure: 6 }, expiresIn30Days);
        }
      }

      // DECLINING USER rewards
      if (segment === "declining") {
        addReward("coupon", "💸 Come Back Offer", "20% cashback on your next transaction (max ৳100)!",
          { discount_type: "percentage", discount_value: 20, max_discount: 100 }, expiresIn7Days);
        addReward("offer", "🎯 Activity Challenge", "Make 5 transactions this week & win ৳75",
          { target_txn_count: 5, reward_amount: 75, period: "7_days" }, expiresIn7Days);
      }

      // INACTIVE USER rewards
      if (segment === "inactive") {
        addReward("gift_card", "🎁 We Miss You!", "Claim your ৳50 welcome-back gift card",
          { denomination: 50, brand: "EasyPay" }, expiresIn14Days);
        addReward("coupon", "🔥 Comeback Deal", "30% cashback on your next 3 transactions!",
          { discount_type: "percentage", discount_value: 30, max_discount: 150, max_uses: 3 }, expiresIn14Days);
      }

      // COMEBACK USER rewards
      if (segment === "comeback") {
        addReward("gift_card", "🎊 Welcome Back Hero!", "Claim ৳100 gift card + premium features",
          { denomination: 100, brand: "EasyPay", bonus: "premium_7_days" }, expiresIn7Days);
        addReward("coupon", "💎 Comeback Special", "50% cashback up to ৳200 on your first transaction back!",
          { discount_type: "percentage", discount_value: 50, max_discount: 200 }, expiresIn7Days);
      }
    }

    // 6. Batch insert rewards
    let inserted = 0;
    if (rewardsToInsert.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < rewardsToInsert.length; i += 50) {
        const batch = rewardsToInsert.slice(i, i + 50);
        const { error } = await supabase.from("ai_auto_rewards").insert(batch);
        if (!error) inserted += batch.length;
        else console.error("Insert batch error:", error);
      }
    }

    // 7. Expire old rewards
    await supabase
      .from("ai_auto_rewards")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("expires_at", new Date().toISOString());

    return new Response(JSON.stringify({
      message: `Analyzed ${profiles.length} users, generated ${inserted} new rewards`,
      users_analyzed: profiles.length,
      rewards_generated: inserted,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Auto-reward error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
