// Wishlist nudge: push users whose wishlist has items added > 24h ago and they haven't purchased that product yet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Wishlist entries older than 24h, newer than 7 days (avoid spamming forever)
    const { data: items, error } = await supabase
      .from("wishlists")
      .select("user_id, product_id, created_at")
      .lte("created_at", cutoff)
      .gte("created_at", recent);

    if (error) throw error;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ checked: 0, pushed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group: { userId -> count }
    const byUser = new Map<string, number>();
    for (const w of items) byUser.set(w.user_id, (byUser.get(w.user_id) ?? 0) + 1);

    const userIds = Array.from(byUser.keys());

    // Skip users who already got a nudge in the last 3 days
    const threeAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNudges } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("category", "wishlist_nudge")
      .gte("created_at", threeAgo)
      .in("user_id", userIds);
    const skip = new Set((recentNudges ?? []).map((n: any) => n.user_id));

    const inserts: any[] = [];
    const pushTargets: string[] = [];
    for (const [uid, n] of byUser.entries()) {
      if (skip.has(uid)) continue;
      const title = n === 1 ? "Still thinking it over? 💭" : `${n} items waiting in your wishlist 💭`;
      const body = n === 1
        ? "An item in your wishlist is still available — grab it before it's gone."
        : `${n} items in your wishlist are still available. Take another look.`;
      inserts.push({
        user_id: uid,
        title,
        body,
        category: "wishlist_nudge",
        metadata: { count: n, event: "wishlist_nudge" },
      });
      pushTargets.push(uid);
    }

    if (inserts.length > 0) {
      await supabase.from("notifications").insert(inserts);
    }

    let pushed = 0;
    if (pushTargets.length > 0) {
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: pushTargets,
            title: "Your wishlist is waiting 💭",
            body: "Tap to revisit the items you saved.",
            url: "/wishlist",
          },
        });
        pushed = pushTargets.length;
      } catch (_) { /* swallow */ }
    }

    return new Response(JSON.stringify({ checked: byUser.size, pushed, inserted: inserts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
