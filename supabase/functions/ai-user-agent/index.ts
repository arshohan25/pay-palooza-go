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

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Require admin JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, user_id, message } = await req.json();

    // ACTION: analyze_all — scan all users and generate recommendations
    if (action === "analyze_all") {
      // Get user stats
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, phone, status, created_at, balance, kyc_status")
        .order("created_at", { ascending: false })
        .limit(200);

      const { data: txnStats } = await supabase.rpc("get_user_activity_summary");

      // Get recent transaction patterns
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentTxns } = await supabase
        .from("transactions")
        .select("user_id, type, amount, status, created_at")
        .gte("created_at", thirtyDaysAgo)
        .eq("status", "completed")
        .limit(1000);

      // Build user activity map
      const userActivity: Record<string, any> = {};
      (recentTxns || []).forEach((t: any) => {
        if (!userActivity[t.user_id]) {
          userActivity[t.user_id] = { txn_count: 0, total_volume: 0, types: new Set(), last_txn: t.created_at };
        }
        const u = userActivity[t.user_id];
        u.txn_count++;
        u.total_volume += Number(t.amount);
        u.types.add(t.type);
        if (t.created_at > u.last_txn) u.last_txn = t.created_at;
      });

      // Convert sets to arrays for serialization
      Object.values(userActivity).forEach((u: any) => {
        u.types = [...u.types];
      });

      // Categorize users
      const now = Date.now();
      const categories = {
        power_users: [] as any[],
        active_users: [] as any[],
        declining_users: [] as any[],
        inactive_users: [] as any[],
        new_users: [] as any[],
        comeback_users: [] as any[],
      };

      (profiles || []).forEach((p: any) => {
        const activity = userActivity[p.id];
        const accountAgeDays = Math.floor((now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceLastTxn = activity?.last_txn
          ? Math.floor((now - new Date(activity.last_txn).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const userData = {
          id: p.id,
          name: p.name || p.phone || "Unknown",
          phone: p.phone,
          balance: p.balance,
          kyc_status: p.kyc_status,
          account_age_days: accountAgeDays,
          txn_count: activity?.txn_count || 0,
          total_volume: activity?.total_volume || 0,
          txn_types: activity?.types || [],
          days_since_last_txn: daysSinceLastTxn,
          status: p.status,
        };

        if (accountAgeDays <= 7) {
          categories.new_users.push(userData);
        } else if (daysSinceLastTxn > 30 && daysSinceLastTxn < 90 && activity?.txn_count > 0) {
          categories.inactive_users.push(userData);
        } else if (daysSinceLastTxn >= 90 && activity?.txn_count > 0) {
          categories.comeback_users.push(userData);
        } else if (activity?.txn_count >= 20 && activity?.total_volume >= 50000) {
          categories.power_users.push(userData);
        } else if (activity?.txn_count >= 5) {
          categories.active_users.push(userData);
        } else {
          categories.declining_users.push(userData);
        }
      });

      // Get existing offers/coupons
      const { data: activeCoupons } = await supabase
        .from("coupons")
        .select("code, discount_type, discount_value, used_count, usage_limit")
        .eq("is_active", true)
        .limit(20);

      // Get loan stats
      const { data: loanStats } = await supabase
        .from("loan_applications")
        .select("user_id, status, amount")
        .limit(100);

      const summary = {
        total_users: profiles?.length || 0,
        power_users: categories.power_users.length,
        active_users: categories.active_users.length,
        declining_users: categories.declining_users.length,
        inactive_users: categories.inactive_users.length,
        new_users: categories.new_users.length,
        comeback_users: categories.comeback_users.length,
        active_coupons: activeCoupons?.length || 0,
        total_loans: loanStats?.length || 0,
      };

      // Send to AI for analysis
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an AI agent for EasyPay, a mobile financial services platform. You analyze user behavior and generate smart recommendations.

IMPORTANT: Respond ONLY with valid JSON (no markdown, no code fences). Use this exact structure:
{
  "summary": "Brief overview of platform health",
  "insights": [
    {"category": "power_users|active|declining|inactive|new|comeback", "title": "...", "description": "...", "severity": "info|warning|critical|success"}
  ],
  "recommendations": [
    {
      "type": "coupon|offer|loan|gift_card|notification|feature_unlock",
      "target_segment": "power_users|active|declining|inactive|new|comeback|specific_user",
      "title": "...",
      "description": "...",
      "details": {"discount": "10%", "duration": "7 days", ...},
      "priority": "high|medium|low",
      "expected_impact": "..."
    }
  ],
  "user_highlights": [
    {"user_name": "...", "phone": "...", "reason": "...", "suggested_action": "...", "action_type": "coupon|loan|gift_card|offer"}
  ]
}

Guidelines:
- For POWER users: suggest loyalty rewards, premium features, higher loan limits
- For ACTIVE users: suggest coupons to boost specific transaction types they don't use yet
- For DECLINING users: suggest comeback offers, targeted discounts, push notifications
- For INACTIVE users: suggest re-engagement campaigns, gift cards, special comeback bonuses
- For NEW users: suggest welcome offers, first-transaction bonuses, feature tutorials
- For COMEBACK users: suggest welcome-back rewards, loyalty reinstatement
- For loan eligibility: consider txn_count >= 15, volume >= 5000, account age >= 30 days
- Be specific with amounts in BDT (৳)
- Generate 5-8 recommendations
- Highlight 3-5 specific users worth attention`
            },
            {
              role: "user",
              content: `Analyze this platform data and generate recommendations:

USER SEGMENTS:
${JSON.stringify(summary, null, 2)}

SAMPLE POWER USERS (top 5):
${JSON.stringify(categories.power_users.slice(0, 5), null, 2)}

SAMPLE DECLINING USERS (top 5):
${JSON.stringify(categories.declining_users.slice(0, 5), null, 2)}

SAMPLE INACTIVE USERS (top 5):
${JSON.stringify(categories.inactive_users.slice(0, 5), null, 2)}

SAMPLE NEW USERS (top 5):
${JSON.stringify(categories.new_users.slice(0, 5), null, 2)}

ACTIVE COUPONS:
${JSON.stringify(activeCoupons || [], null, 2)}

LOAN APPLICATIONS:
${JSON.stringify(loanStats || [], null, 2)}`
            }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error: ${status}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "{}";

      // Try to parse the AI response
      let parsed;
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { summary: content, insights: [], recommendations: [], user_highlights: [] };
      }

      return new Response(JSON.stringify({
        ...parsed,
        segments: summary,
        generated_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: chat — have a conversation with the AI agent about a specific user or topic
    if (action === "chat") {
      let context = "";

      if (user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user_id)
          .single();

        const { data: txns } = await supabase
          .from("transactions")
          .select("type, amount, status, created_at")
          .eq("user_id", user_id)
          .order("created_at", { ascending: false })
          .limit(20);

        const { data: loans } = await supabase
          .from("loan_applications")
          .select("*")
          .eq("user_id", user_id)
          .limit(5);

        context = `User Profile: ${JSON.stringify(profile)}
Recent Transactions: ${JSON.stringify(txns)}
Loan Applications: ${JSON.stringify(loans)}`;
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are EasyPay's AI assistant for administrators. Help them understand user behavior, suggest promotions, analyze risk, and optimize engagement. Be concise and actionable. Use ৳ for currency.
${context ? `\nContext about the user being discussed:\n${context}` : ""}`
            },
            { role: "user", content: message }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await aiResponse.json();
      const reply = aiData.choices?.[0]?.message?.content || "Unable to process.";

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("AI agent error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
