import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT using getClaims
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    // Fetch user's recent orders
    const { data: orders } = await supabase
      .from("orders")
      .select("items")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const purchasedNames = (orders ?? [])
      .flatMap((o: any) => (Array.isArray(o.items) ? o.items : []))
      .map((item: any) => item.name)
      .filter(Boolean)
      .slice(0, 10);

    // Fetch available products
    const { data: products } = await supabase
      .from("merchant_products")
      .select("id, name, category, brand, price, rating, review_count")
      .eq("is_active", true)
      .order("review_count", { ascending: false })
      .limit(50);

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ product_ids: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback: return top-rated products
      const ids = products.sort((a, b) => b.rating - a.rating).slice(0, 8).map((p) => p.id);
      return new Response(JSON.stringify({ product_ids: ids }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const catalog = products.map((p) => `${p.id}|${p.name}|${p.category}|${p.brand ?? ""}|৳${p.price}|${p.rating}★`).join("\n");

    const prompt = purchasedNames.length > 0
      ? `User recently purchased: ${purchasedNames.join(", ")}.\n\nProduct catalog:\n${catalog}\n\nReturn the 8 best product IDs for this user. Consider their purchase history for personalization. Return ONLY a JSON array of product ID strings.`
      : `Product catalog:\n${catalog}\n\nReturn the 8 best products to recommend to a new user. Prioritize highly-rated and popular items. Return ONLY a JSON array of product ID strings.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a product recommendation engine. Return only valid JSON arrays of product ID strings. No explanation." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "recommend_products",
            description: "Return recommended product IDs",
            parameters: {
              type: "object",
              properties: {
                product_ids: { type: "array", items: { type: "string" } }
              },
              required: ["product_ids"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "recommend_products" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429 || aiResp.status === 402) {
        // Fallback
        const ids = products.sort((a, b) => b.rating - a.rating).slice(0, 8).map((p) => p.id);
        return new Response(JSON.stringify({ product_ids: ids }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let productIds: string[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        productIds = parsed.product_ids ?? [];
      } catch {
        // fallback
      }
    }

    if (productIds.length === 0) {
      productIds = products.sort((a, b) => b.rating - a.rating).slice(0, 8).map((p) => p.id);
    }

    return new Response(JSON.stringify({ product_ids: productIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("product-recommendations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
