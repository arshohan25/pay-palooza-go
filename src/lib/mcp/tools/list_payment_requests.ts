import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sbForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_payment_requests",
  title: "List payment requests",
  description:
    "List the signed-in user's EasyPay payment links with totals received, remaining balance, and status. Useful for reporting recent activity.",
  inputSchema: {
    limit: z.number().int().positive().optional().describe("Max rows to return (default 20)."),
    only_active: z.boolean().optional().describe("If true, only include active links."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, only_active }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = sbForUser(ctx);
    let q = sb
      .from("payment_links")
      .select("id, short_code, title, amount, currency, is_active, amount_paid, used_count, deactivated_reason, created_at")
      .eq("created_by", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(Math.min(limit ?? 20, 100));
    if (only_active) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const totalReceived = rows.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0);
    const lines = rows.map((r) => {
      const paid = Number(r.amount_paid ?? 0);
      const target = r.amount ? Number(r.amount) : null;
      const status = !r.is_active ? `inactive (${r.deactivated_reason ?? "manual"})` : "active";
      return `• ${r.short_code} — ${r.title} — ${status} — ৳${paid.toFixed(2)}${target != null ? `/৳${Number(target).toFixed(2)}` : ""}`;
    });
    const text = rows.length
      ? `${rows.length} payment request(s). Total received: ৳${totalReceived.toFixed(2)}\n${lines.join("\n")}`
      : "No payment requests yet.";
    return { content: [{ type: "text", text }], structuredContent: { total_received: totalReceived, links: rows } };
  },
});
