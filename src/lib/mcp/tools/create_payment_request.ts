import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sbForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function randomCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export default defineTool({
  name: "create_payment_request",
  title: "Create payment request",
  description:
    "Create an EasyPay payment link for the signed-in user. Returns the short code and shareable URL customers can use to pay.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Short title shown to the payer."),
    amount: z
      .number()
      .positive()
      .optional()
      .describe("Requested amount in BDT. Omit for pay-what-you-want (payer chooses)."),
    description: z.string().trim().optional().describe("Optional message shown to the payer."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, amount, description }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = sbForUser(ctx);
    const short_code = randomCode();
    const { data, error } = await sb
      .from("payment_links")
      .insert({
        title,
        amount: amount ?? null,
        currency: "BDT",
        short_code,
        description: description ?? null,
        created_by: ctx.getUserId(),
        is_active: true,
      })
      .select("id, short_code, title, amount, currency, is_active, created_at")
      .single();
    if (error || !data) {
      return { content: [{ type: "text", text: error?.message ?? "Insert failed" }], isError: true };
    }
    const url = `https://pay-palooza-go.lovable.app/r/${data.short_code}`;
    return {
      content: [
        {
          type: "text",
          text: `Created payment request "${data.title}"${data.amount ? ` for ৳${data.amount}` : " (any amount)"}. Share: ${url}`,
        },
      ],
      structuredContent: { link: data, url },
    };
  },
});
