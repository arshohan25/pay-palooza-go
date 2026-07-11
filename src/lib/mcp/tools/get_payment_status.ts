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
  name: "get_payment_status",
  title: "Get payment request status",
  description:
    "Look up an EasyPay payment link by short code and return its current state, total received, remaining balance, and recent payment attempts.",
  inputSchema: {
    short_code: z.string().trim().min(1).describe("Short code from the payment link URL (e.g. the part after /r/)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ short_code }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = sbForUser(ctx);
    const { data: link, error } = await sb
      .from("payment_links")
      .select("id, title, amount, currency, is_active, amount_paid, used_count, max_uses, deactivated_reason, expires_at, created_at")
      .eq("short_code", short_code)
      .eq("created_by", ctx.getUserId())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!link) return { content: [{ type: "text", text: "Payment request not found" }], isError: true };

    const { data: payments } = await sb
      .from("payment_link_payments")
      .select("id, amount, status, refunded_amount, created_at, transaction_id")
      .eq("link_id", link.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const paid = Number(link.amount_paid ?? 0);
    const target = link.amount ? Number(link.amount) : null;
    const remaining = target != null ? Math.max(target - paid, 0) : null;
    const state = !link.is_active
      ? `inactive (${link.deactivated_reason ?? "manual"})`
      : payments && payments.some((p) => p.status === "processing")
      ? "processing"
      : paid > 0
      ? "partially paid"
      : "active";

    const summary =
      `Link "${link.title}" — ${state}. Received ৳${paid.toFixed(2)}` +
      (target != null ? ` of ৳${target.toFixed(2)} (remaining ৳${remaining!.toFixed(2)})` : "") +
      `. ${payments?.length ?? 0} attempt(s).`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { link, payments: payments ?? [], paid, remaining, state },
    };
  },
});
