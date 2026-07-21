import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

// Beta Supabase OAuth server methods — tiny typed wrapper.
type OAuthAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthAuth }).oauth;

export default function OAuthConsent() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError(t("ocMissingAuthId"));
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, t]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError(t("ocNoRedirect"));
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full space-y-3">
          <h1 className="text-xl font-semibold">{t("ocLoadFailed")}</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">{t("ocLoading")}</p>
      </main>
    );
  }
  const clientName = details.client?.name ?? details.client?.client_name ?? t("ocFallbackAppName");
  const redirectUri = details.client?.redirect_uris?.[0] ?? details.redirect_uri ?? "";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 space-y-4 shadow">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{t("ocConnectTitle").replace("{name}", clientName)}</h1>
          <p className="text-sm text-muted-foreground">
            {t("ocConnectDesc").replace("{name}", clientName)}
          </p>
        </div>
        {redirectUri && (
          <p className="text-xs text-muted-foreground break-all">{t("ocRedirectsTo").replace("{url}", redirectUri)}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {t("ocPolicyNote")}
        </p>
        <div className="flex gap-2 pt-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {t("ocApprove")}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-xl bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {t("ocCancel")}
          </button>
        </div>
      </div>
    </main>
  );
}
