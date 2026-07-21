import { supabase } from "@/integrations/supabase/client";

export interface InvokeMerchantLoginResult {
  body: any | null;
  status: number | undefined;
  headerRetry: number | null;
  error: any | null;
  /** True when the raw /functions/v1/merchant-login fallback was used. */
  usedFallback: boolean;
}

const NETWORK_ERR_RE =
  /failed to send a request|failed to fetch|network|load failed/i;

/**
 * Calls the `merchant-login` edge function. If `supabase.functions.invoke`
 * throws a network-style error (e.g. `FunctionsFetchError` on mobile/PWA
 * networks at smartshop.bd), retries once via raw `fetch` against
 * `${VITE_SUPABASE_URL}/functions/v1/merchant-login` before surfacing.
 *
 * Extracted from `MerchantLoginPage` so the fallback path is unit-testable.
 */
export async function invokeMerchantLoginWithFallback(
  payload: Record<string, unknown>,
): Promise<InvokeMerchantLoginResult> {
  let data: any = null;
  let error: any = null;
  let ctx: any = null;
  let status: number | undefined;
  let headerRetry: number | null = null;
  let usedFallback = false;

  try {
    const res = await supabase.functions.invoke("merchant-login", { body: payload });
    data = res.data;
    error = res.error;
    ctx = (error as any)?.context ?? null;
  } catch (e: any) {
    error = e;
  }

  let body: any = data ?? null;
  if (!body && typeof ctx?.json === "function") {
    try { body = await ctx.clone().json(); } catch {}
  }
  if (!body && typeof ctx?.text === "function") {
    try { body = JSON.parse(await ctx.clone().text()); } catch {}
  }
  status = ctx?.status;
  headerRetry = (() => {
    try {
      const h = ctx?.headers?.get?.("retry-after");
      const n = h ? parseInt(h, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  })();

  const looksLikeFetchFailure =
    !body && !ctx && error &&
    NETWORK_ERR_RE.test(String((error as any)?.message ?? ""));

  if (looksLikeFetchFailure) {
    usedFallback = true;
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-login`;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey,
          Authorization: `Bearer ${apikey}`,
        },
        body: JSON.stringify(payload),
      });
      status = resp.status;
      try { body = await resp.json(); } catch { body = null; }
      const h = resp.headers.get("retry-after");
      const n = h ? parseInt(h, 10) : NaN;
      headerRetry = Number.isFinite(n) && n > 0 ? n : null;
      error = null;
    } catch (e: any) {
      error = e;
    }
  }

  return { body, status, headerRetry, error, usedFallback };
}
