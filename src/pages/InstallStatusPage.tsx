import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

type RoleKey = "customer" | "agent" | "merchant" | "distributor" | "super-distributor" | "admin";

interface RoleCheck {
  role: RoleKey;
  label: string;
  installPath: string;
  manifestPath: string | null;
  expectedManifestName: RegExp;
  expectedScope?: string;
}

const CHECKS: RoleCheck[] = [
  { role: "customer", label: "Customer", installPath: "/customer/install", manifestPath: "/manifest.json", expectedManifestName: /EasyPay/i, expectedScope: "/customer/" },
  { role: "agent", label: "Agent", installPath: "/agent/install", manifestPath: "/manifest-agent.json", expectedManifestName: /Agent/i, expectedScope: "/agent/" },
  { role: "merchant", label: "Merchant", installPath: "/merchant/install", manifestPath: "/manifest-merchant.json", expectedManifestName: /Merchant/i, expectedScope: "/merchant/" },
  { role: "distributor", label: "Distributor", installPath: "/distributor/install", manifestPath: "/manifest-distributor.json", expectedManifestName: /Distributor/i, expectedScope: "/distributor/" },
  { role: "super-distributor", label: "Super Distributor", installPath: "/super-distributor/install", manifestPath: "/manifest-super-distributor.json", expectedManifestName: /Super Distributor/i, expectedScope: "/super-distributor/" },
  { role: "admin", label: "Admin", installPath: "/admin/install", manifestPath: "/manifest-admin.json", expectedManifestName: /Admin/i, expectedScope: "/admin/" },
];

type Status = "idle" | "checking" | "ok" | "fail";

interface Result {
  status: Status;
  pageOk?: boolean;
  pageStatus?: number;
  manifestOk?: boolean;
  manifestName?: string;
  manifestStartUrl?: string;
  manifestScope?: string;
  latencyMs?: number;
  error?: string;
  checkedAt?: number;
}

const InstallStatusPage = () => {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState<"published" | "current">("current");

  const origin =
    target === "published"
      ? "https://pay-palooza-go.lovable.app"
      : typeof window !== "undefined"
      ? window.location.origin
      : "";

  const runCheck = useCallback(
    async (c: RoleCheck): Promise<Result> => {
      const t0 = performance.now();
      try {
        // HEAD/GET the install page (no-cors fallback for cross-origin)
        const pageUrl = `${origin}${c.installPath}`;
        const pageRes = await fetch(pageUrl, { method: "GET", cache: "no-store", mode: "cors" }).catch(
          () => null,
        );

        let pageOk = false;
        let pageStatus: number | undefined;
        if (pageRes) {
          pageStatus = pageRes.status;
          pageOk = pageRes.ok;
        }

        let manifestOk = false;
        let manifestName: string | undefined;
        let manifestStartUrl: string | undefined;
        let manifestScope: string | undefined;
        if (c.manifestPath) {
          const mRes = await fetch(`${origin}${c.manifestPath}`, { cache: "no-store" });
          if (mRes.ok) {
            const body = await mRes.json();
            manifestName = body.name;
            manifestStartUrl = body.start_url;
            manifestScope = body.scope;
            manifestOk =
              c.expectedManifestName.test(String(body.name || "")) &&
              (!c.expectedScope || String(body.scope || "") === c.expectedScope);
          }
        } else {
          manifestOk = true;
        }

        const latencyMs = Math.round(performance.now() - t0);
        const ok = pageOk && manifestOk;
        return {
          status: ok ? "ok" : "fail",
          pageOk,
          pageStatus,
          manifestOk,
          manifestName,
          manifestStartUrl,
          manifestScope,
          latencyMs,
          checkedAt: Date.now(),
        };
      } catch (e: any) {
        return {
          status: "fail",
          error: e?.message ?? "Network error",
          latencyMs: Math.round(performance.now() - t0),
          checkedAt: Date.now(),
        };
      }
    },
    [origin],
  );

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults((prev) => {
      const next = { ...prev };
      for (const c of CHECKS) next[c.role] = { ...(next[c.role] ?? {}), status: "checking" };
      return next;
    });
    const entries = await Promise.all(
      CHECKS.map(async (c) => [c.role, await runCheck(c)] as const),
    );
    setResults(Object.fromEntries(entries));
    setRunning(false);
    const failed = entries.filter(([, r]) => r.status === "fail").length;
    if (failed === 0) toast.success("All install links verified working");
    else toast.error(`${failed} of ${entries.length} install link(s) failing`);
  }, [runCheck]);

  useEffect(() => {
    runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const okCount = Object.values(results).filter((r) => r.status === "ok").length;
  const failCount = Object.values(results).filter((r) => r.status === "fail").length;

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Install Link Status
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Live check that every <code className="font-mono">/install/&lt;role&gt;</code>{" "}
                route and its PWA manifest are reachable after deployment.
              </p>
            </div>
            <button
              type="button"
              onClick={runAll}
              disabled={running}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Re-run checks
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Target:</span>
            {(["current", "published"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className={`px-2.5 py-1 rounded-full border ${
                  target === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-foreground"
                }`}
              >
                {t === "current" ? "This origin" : "Published (pay-palooza-go)"}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} /> {okCount} OK
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <XCircle size={14} /> {failCount} failing
              </span>
            </span>
          </div>
        </header>

        <ul className="space-y-2">
          {CHECKS.map((c) => {
            const r = results[c.role] ?? { status: "idle" as Status };
            const url = `${origin}${c.installPath}`;
            return (
              <li
                key={c.role}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <StatusDot status={r.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{c.label}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{url}</p>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent"
                    aria-label="Open"
                  >
                    <ExternalLink size={13} />
                  </a>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Copied");
                      } catch {
                        toast.error("Copy failed");
                      }
                    }}
                    className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent"
                    aria-label="Copy link"
                  >
                    <Copy size={13} />
                  </button>
                </div>

                {r.status !== "idle" && r.status !== "checking" && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <Metric
                      label="Page"
                      ok={r.pageOk}
                      value={r.pageStatus ? `HTTP ${r.pageStatus}` : r.error ? "Unreachable" : "—"}
                    />
                    <Metric
                      label="Manifest"
                      ok={r.manifestOk}
                      value={r.manifestName ?? (c.manifestPath ? "Missing" : "N/A")}
                    />
                    <Metric label="Latency" ok={r.latencyMs != null && r.latencyMs < 2000} value={`${r.latencyMs ?? 0} ms`} />
                    <Metric
                      label="Checked"
                      ok
                      value={r.checkedAt ? new Date(r.checkedAt).toLocaleTimeString() : "—"}
                    />
                    {r.manifestStartUrl && (
                      <p className="col-span-2 sm:col-span-4 text-[10px] text-muted-foreground font-mono truncate">
                        start_url: {r.manifestStartUrl} {r.manifestScope ? `· scope: ${r.manifestScope}` : ""}
                      </p>
                    )}
                    {r.error && (
                      <p className="col-span-2 sm:col-span-4 text-[10px] text-destructive">
                        {r.error}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Also see the{" "}
          <Link to="/install" className="underline">
            install landing page
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

const StatusDot = ({ status }: { status: Status }) => {
  if (status === "checking")
    return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />;
  if (status === "ok") return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
  if (status === "fail") return <XCircle className="w-5 h-5 text-destructive shrink-0" />;
  return <span className="w-5 h-5 rounded-full border border-border shrink-0" />;
};

const Metric = ({ label, value, ok }: { label: string; value: string; ok?: boolean }) => (
  <div
    className={`rounded-lg border px-2 py-1.5 ${
      ok === false
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : ok
        ? "border-emerald-500/20 bg-emerald-500/5 text-foreground"
        : "border-border bg-background text-foreground"
    }`}
  >
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-medium truncate">{value}</p>
  </div>
);

export default InstallStatusPage;
