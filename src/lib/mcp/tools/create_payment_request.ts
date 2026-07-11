import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sbForUser, withToolAudit } from "../lib/tool-helpers";

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
  handler: withToolAudit("create_payment_request", async ({ title, amount, description }, ctx) => {
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
        source: "mcp",
      })
      .select("id, short_code, title, amount, currency, is_active, created_at, source")
      .single();
    if (error || !data) {
      // Let withToolAudit map to a friendly message.
      throw new Error(error?.message ?? "Could not create payment request");
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
  }),
});
