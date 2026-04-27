import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Standardized admin-authz error contract shared across threshold-related
 * Edge Functions. Always returns:
 *   { error: { code, message } }
 * with stable HTTP status (401 UNAUTHORIZED, 403 FORBIDDEN_ADMIN_REQUIRED).
 */
function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Mask a secret value, showing only last 4 chars */
function maskValue(val: string): string {
  if (!val || val.length <= 4) return "••••";
  return "••••••••" + val.slice(-4);
}

/** Fields that are considered non-secret (safe to return in full) */
const NON_SECRET_FIELDS = new Set([
  "mode", "receiving_number", "MERCHANT_ID", "NAGAD_MERCHANT_ID",
  "ROCKET_MERCHANT_ID", "UPAY_MERCHANT_ID", "TAP_MERCHANT_ID", "MCASH_MERCHANT_ID",
]);

function maskConfig(config: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, val] of Object.entries(config)) {
    if (!val) {
      masked[key] = "";
    } else if (NON_SECRET_FIELDS.has(key)) {
      masked[key] = val;
    } else {
      masked[key] = maskValue(val);
    }
  }
  return masked;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Verify admin role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, table } = body;

    // Validate table parameter
    const allowedTables = ["payment_gateways", "recharge_api_configs", "biller_api_configs"];
    if (!allowedTables.includes(table)) {
      return new Response(JSON.stringify({ error: "Invalid table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      // Return configs with masked secrets
      const { data, error } = await supabaseAdmin
        .from(table)
        .select("*")
        .order(table === "payment_gateways" ? "sort_order" : table === "biller_api_configs" ? "sort_order" : "operator");

      if (error) throw error;

      const masked = (data ?? []).map((row: any) => ({
        ...row,
        config: maskConfig(row.config || {}),
      }));

      return new Response(JSON.stringify(masked), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_config") {
      const { id, config, display_name, api_base_url } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get existing config to merge (preserve unchanged masked fields)
      const { data: existing } = await supabaseAdmin
        .from(table)
        .select("config")
        .eq("id", id)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Merge: if the incoming value looks masked (starts with ••), keep the old value
      const existingConfig = (existing.config || {}) as Record<string, string>;
      const mergedConfig: Record<string, string> = {};

      if (config && typeof config === "object") {
        for (const [key, val] of Object.entries(config as Record<string, string>)) {
          if (val && val.startsWith("••")) {
            // Keep existing value
            mergedConfig[key] = existingConfig[key] || "";
          } else {
            mergedConfig[key] = val;
          }
        }
      }

      const updatePayload: Record<string, unknown> = { config: mergedConfig };
      if (display_name !== undefined) updatePayload.display_name = display_name;
      if (api_base_url !== undefined) updatePayload.api_base_url = api_base_url;

      const { error } = await supabaseAdmin
        .from(table)
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;

      // Audit log
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId,
        action: "gateway_config_update",
        entity_type: table,
        entity_id: id,
        details: { fields_updated: Object.keys(config || {}) },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle") {
      const { id, is_enabled } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from(table)
        .update({ is_enabled })
        .eq("id", id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { provider, display_name, config: newConfig, sort_order, biller_code, category, api_base_url } = body;
      if (table === "biller_api_configs") {
        if (!biller_code || !display_name || !category) {
          return new Response(JSON.stringify({ error: "Missing required fields (biller_code, display_name, category)" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (!provider || !display_name) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const insertPayload: Record<string, unknown> = {
        display_name,
        config: newConfig || {},
      };
      if (table === "biller_api_configs") {
        insertPayload.biller_code = biller_code;
        insertPayload.category = category;
        if (api_base_url !== undefined) insertPayload.api_base_url = api_base_url;
      } else {
        insertPayload.provider = provider;
      }
      if (sort_order !== undefined) insertPayload.sort_order = sort_order;

      const { error } = await supabaseAdmin.from(table).insert(insertPayload);

      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ error: "Provider already exists" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-gateway-config error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
