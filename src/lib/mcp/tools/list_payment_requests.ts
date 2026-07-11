import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sbForUser, withToolAudit } from "../lib/tool-helpers";

export default defineTool({
  name: "list_payment_requests",
  title: "List payment requests",
  description:
    "List the signed-in user's EasyPay payment links with totals received, remaining balance, and status. Useful for reporting recent activity.",
  inputSchema: {
    limit: z.number().int().positive().optional().describe("Max rows to return (default 20)."),
    only_active: z.boolean().optional().describe("If true, only include active links."),
    only_mcp: z.boolean().optional().describe("If true, only include links created via an AI assistant (source = 'mcp')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: withToolAudit("list_payment_requests", async ({ limit, only_active, only_mcp }, ctx) => {
    const sb = sbForUser(ctx);
    let q = sb
      .from("payment_links")
      .select("id, short_code, title, amount, currency, is_active, amount_paid, used_count, deactivated_reason, created_at, source")
      .eq("created_by", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(Math.min(limit ?? 20, 100));
    if (only_active) q = q.eq("is_active", true);
    if (only_mcp) q = q.eq("source", "mcp");
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const totalReceived = rows.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0);
    const lines = rows.map((r) => {
      const paid = Number(r.amount_paid ?? 0);
      const target = r.amount ? Number(r.amount) : null;
      const status = !r.is_active ? `inactive (${r.deactivated_reason ?? "manual"})` : "active";
      const badge = r.source === "mcp" ? " [via AI]" : "";
      return `• ${r.short_code} — ${r.title}${badge} — ${status} — ৳${paid.toFixed(2)}${target != null ? `/৳${Number(target).toFixed(2)}` : ""}`;
    });
    const text = rows.length
      ? `${rows.length} payment request(s). Total received: ৳${totalReceived.toFixed(2)}\n${lines.join("\n")}`
      : "No payment requests yet.";
    return { content: [{ type: "text", text }], structuredContent: { total_received: totalReceived, links: rows } };
  }),
});
