import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  getAuthDiagnostics,
  subscribeAuthDiagnostics,
  retryAuth,
  type AuthDiagnostics,
} from "@/hooks/use-auth";
import { RefreshCw, ShieldCheck, ShieldAlert, Activity } from "lucide-react";

type TokenCheck = {
  runAt: number;
  ok: boolean;
  status?: number;
  message?: string;
  userId?: string | null;
  expiresAt?: number | null;
  expiresInSec?: number | null;
};

function fmtTime(ms: number | null | undefined) {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleString(); } catch { return String(ms); }
}
function fmtEpochSec(sec: number | null | undefined) {
  if (!sec) return "—";
  return fmtTime(sec * 1000);
}

async function runTokenValidation(): Promise<TokenCheck> {
  const runAt = Date.now();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const expiresAt = sessionData.session?.expires_at ?? null;
  if (!token) {
    return { runAt, ok: false, message: "No local session", expiresAt };
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    return {
      runAt,
      ok: false,
      status: (error as any).status,
      message: error.message,
      expiresAt,
      expiresInSec: expiresAt ? expiresAt - Math.floor(runAt / 1000) : null,
    };
  }
  return {
    runAt,
    ok: true,
    userId: data.user?.id ?? null,
    expiresAt,
    expiresInSec: expiresAt ? expiresAt - Math.floor(runAt / 1000) : null,
  };
}

export default function AdminAuthDiagnosticsPage() {
  const [diag, setDiag] = useState<AuthDiagnostics>(getAuthDiagnostics());
  const [check, setCheck] = useState<TokenCheck | null>(null);
  const [busy, setBusy] = useState<"validate" | "refresh" | null>(null);

  useEffect(() => subscribeAuthDiagnostics(setDiag), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await runTokenValidation();
      if (!cancelled) setCheck(r);
    })();
    const iv = setInterval(async () => {
      const r = await runTokenValidation();
      if (!cancelled) setCheck(r);
    }, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const doValidate = async () => {
    setBusy("validate");
    const r = await runTokenValidation();
    setCheck(r);
    setBusy(null);
  };
  const doRefresh = async () => {
    setBusy("refresh");
    await retryAuth();
    const r = await runTokenValidation();
    setCheck(r);
    setBusy(null);
  };

  const statusColor =
    diag.status === "authenticated" ? "text-emerald-600"
    : diag.status === "error" ? "text-destructive"
    : diag.status === "unauthenticated" ? "text-muted-foreground"
    : "text-amber-600";

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <Helmet>
        <title>Auth Diagnostics — Admin</title>
        <meta name="description" content="Admin-only authentication and session diagnostics panel." />
      </Helmet>
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Auth Diagnostics</h1>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Session status</h2>
            <span className={`text-sm font-semibold uppercase tracking-wide ${statusColor}`}>
              {diag.status}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="font-mono break-all">{diag.userId ?? "—"}</dd>
            <dt className="text-muted-foreground">Token expires</dt>
            <dd>{fmtEpochSec(diag.tokenExpiresAt)}</dd>
            <dt className="text-muted-foreground">Last validated</dt>
            <dd>{fmtTime(diag.lastValidatedAt)}</dd>
            <dt className="text-muted-foreground">Last validation OK</dt>
            <dd>{diag.lastValidationOk == null ? "—" : diag.lastValidationOk ? "yes" : "no"}</dd>
            <dt className="text-muted-foreground">Refresh attempts</dt>
            <dd>{diag.refreshAttempts}</dd>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Last auth error</h2>
          {diag.lastError ? (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <ShieldAlert className="w-4 h-4" />
                {diag.lastError.source}{diag.lastError.code ? ` · ${diag.lastError.code}` : ""}
              </div>
              <p className="mt-1 font-mono break-words">{diag.lastError.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">at {fmtTime(diag.lastError.at)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> No recent errors.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Token validation (auth/v1/user)</h2>
            <div className="flex gap-2">
              <button
                onClick={doValidate}
                disabled={busy !== null}
                className="text-xs px-3 h-8 rounded-lg border border-border bg-background inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${busy === "validate" ? "animate-spin" : ""}`} /> Validate
              </button>
              <button
                onClick={doRefresh}
                disabled={busy !== null}
                className="text-xs px-3 h-8 rounded-lg bg-primary text-primary-foreground inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${busy === "refresh" ? "animate-spin" : ""}`} /> Refresh session
              </button>
            </div>
          </div>
          {check ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Result</dt>
              <dd className={check.ok ? "text-emerald-600 font-semibold" : "text-destructive font-semibold"}>
                {check.ok ? "OK" : "Rejected"}
              </dd>
              {check.status != null && (<><dt className="text-muted-foreground">HTTP status</dt><dd>{check.status}</dd></>)}
              {check.message && (<><dt className="text-muted-foreground">Message</dt><dd className="font-mono break-words">{check.message}</dd></>)}
              <dt className="text-muted-foreground">User</dt>
              <dd className="font-mono break-all">{check.userId ?? "—"}</dd>
              <dt className="text-muted-foreground">Expires</dt>
              <dd>{fmtEpochSec(check.expiresAt)}</dd>
              <dt className="text-muted-foreground">Expires in</dt>
              <dd>{check.expiresInSec != null ? `${check.expiresInSec}s` : "—"}</dd>
              <dt className="text-muted-foreground">Ran at</dt>
              <dd>{fmtTime(check.runAt)}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Running…</p>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          Panel auto-refreshes every 15s. Admin-only.
        </p>
      </div>
    </div>
  );
}
