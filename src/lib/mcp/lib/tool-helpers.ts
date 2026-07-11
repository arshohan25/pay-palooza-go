import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

// ────────────────────────────────────────────────────────────────────────────
// Supabase clients
// ────────────────────────────────────────────────────────────────────────────

/** Per-request user client: runs under the caller's RLS. */
export function sbForUser(ctx: ToolContext): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client: used only for internal audit logging. */
function sbService(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ────────────────────────────────────────────────────────────────────────────
// Friendly error mapping
// ────────────────────────────────────────────────────────────────────────────

export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const msg = raw.toLowerCase();

  if (!raw) return "Something went wrong. Please try again.";

  if (msg.includes("jwt expired") || msg.includes("token is expired") || msg.includes("expired token")) {
    return "Your sign-in for this assistant has expired. Please reconnect the EasyPay MCP server in your AI client to grant fresh consent.";
  }
  if (msg.includes("invalid jwt") || msg.includes("invalid token") || msg.includes("malformed")) {
    return "The access token supplied to EasyPay is invalid. Reconnect the EasyPay MCP server in your AI client.";
  }
  if (msg.includes("not authenticated") || msg.includes("no authorization")) {
    return "You are not signed in. Reconnect the EasyPay MCP server and approve the consent screen.";
  }
  if (
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("row level security") ||
    msg.includes("rls") ||
    msg.includes("not allowed")
  ) {
    return "You do not have permission to perform this action on your EasyPay account. Check that your account has the required access, then retry.";
  }
  if (msg.includes("consent")) {
    return "This action needs consent that hasn't been granted yet. Approve the EasyPay consent screen in your AI client and try again.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("timeout")) {
    return "EasyPay could not be reached right now. Please retry in a moment.";
  }
  // Preserve the underlying message but prefix so users understand where it came from.
  return `EasyPay could not complete this request: ${raw}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Audit logging
// ────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  correlationId: string;
  toolName: string;
  userId: string | null;
  clientId?: string | null;
  args: Record<string, unknown>;
  status: "succeeded" | "failed";
  resultSummary?: string | null;
  error?: string | null;
  durationMs: number;
}

async function writeAudit(entry: AuditEntry): Promise<void> {
  const svc = sbService();
  if (!svc) return; // Service role not present in local dev — skip silently.
  try {
    await svc.from("mcp_tool_call_logs").insert({
      correlation_id: entry.correlationId,
      user_id: entry.userId,
      client_id: entry.clientId ?? null,
      tool_name: entry.toolName,
      arguments: entry.args,
      status: entry.status,
      result_summary: entry.resultSummary ?? null,
      error: entry.error ?? null,
      duration_ms: entry.durationMs,
    });
  } catch (e) {
    // Never let audit failures break a tool call — just log.
    console.error(`[mcp-audit] failed to write log for ${entry.toolName}:`, e);
  }
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/**
 * Wraps a tool handler with:
 *  - correlation ID (returned to caller in structuredContent._meta so agents can quote it)
 *  - server-side console logging (stdout is captured by Supabase edge logs)
 *  - persistent audit row in `mcp_tool_call_logs`
 *  - unified friendly-error mapping for any thrown or returned error
 */
export function withToolAudit<Args extends Record<string, unknown>>(
  toolName: string,
  fn: (args: Args, ctx: ToolContext) => Promise<ToolResult>,
) {
  return async (args: Args, ctx: ToolContext): Promise<ToolResult> => {
    const correlationId = crypto.randomUUID();
    const started = Date.now();
    const userId = ctx.isAuthenticated() ? ctx.getUserId() : null;
    const clientId = (ctx.getClientId?.() as string | undefined) ?? null;

    console.log(`[mcp] ${toolName} start`, { correlationId, userId, clientId, args });

    try {
      if (!ctx.isAuthenticated()) {
        const text = friendlyError("not authenticated");
        await writeAudit({
          correlationId, toolName, userId: null, clientId, args,
          status: "failed", error: "not_authenticated",
          durationMs: Date.now() - started,
          resultSummary: null,
        });
        return {
          content: [{ type: "text", text }],
          isError: true,
          structuredContent: { _meta: { correlation_id: correlationId, error_code: "not_authenticated" } },
        };
      }

      const result = await fn(args, ctx);
      const durationMs = Date.now() - started;
      const summaryText = result.content?.[0]?.type === "text" ? result.content[0].text.slice(0, 500) : null;

      if (result.isError) {
        const friendly = friendlyError(summaryText ?? "unknown error");
        await writeAudit({
          correlationId, toolName, userId, clientId, args,
          status: "failed", error: summaryText, resultSummary: null,
          durationMs,
        });
        console.warn(`[mcp] ${toolName} failed`, { correlationId, durationMs, error: summaryText });
        return {
          content: [{ type: "text", text: friendly }],
          isError: true,
          structuredContent: {
            ...(result.structuredContent ?? {}),
            _meta: { correlation_id: correlationId, error_code: "tool_error" },
          },
        };
      }

      await writeAudit({
        correlationId, toolName, userId, clientId, args,
        status: "succeeded", resultSummary: summaryText,
        durationMs,
      });
      console.log(`[mcp] ${toolName} ok`, { correlationId, durationMs });

      return {
        ...result,
        structuredContent: {
          ...(result.structuredContent ?? {}),
          _meta: { correlation_id: correlationId },
        },
      };
    } catch (err) {
      const durationMs = Date.now() - started;
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = friendlyError(err);
      await writeAudit({
        correlationId, toolName, userId, clientId, args,
        status: "failed", error: raw,
        durationMs, resultSummary: null,
      });
      console.error(`[mcp] ${toolName} exception`, { correlationId, durationMs, error: raw });
      return {
        content: [{ type: "text", text: `${friendly} (ref: ${correlationId})` }],
        isError: true,
        structuredContent: { _meta: { correlation_id: correlationId, error_code: "exception" } },
      };
    }
  };
}
