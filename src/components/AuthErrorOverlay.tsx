import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";
import {
  clearAuthError,
  retryAuth,
  subscribeAuthError,
  type AuthErrorInfo,
} from "@/hooks/use-auth";

/**
 * Full-screen overlay shown when session validation fails. Gives the user a
 * clear message + retry instead of a stuck splash/skeleton.
 */
export default function AuthErrorOverlay() {
  const [err, setErr] = useState<AuthErrorInfo | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => subscribeAuthError(setErr), []);

  if (!err) return null;

  const lang = (() => {
    try { return localStorage.getItem("mfs_ui_lang") === "bn" ? "bn" : "en"; } catch { return "en"; }
  })();

  const t = lang === "bn"
    ? {
        title: "সেশন যাচাই ব্যর্থ",
        body: "আপনার সেশনটি আর বৈধ নয়। পুনরায় চেষ্টা করুন বা আবার লগ ইন করুন।",
        retry: "পুনরায় চেষ্টা করুন",
        login: "আবার লগ ইন করুন",
      }
    : {
        title: "Session validation failed",
        body: "Your session could not be verified. Please retry or sign in again.",
        retry: "Retry",
        login: "Sign in again",
      };

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    await retryAuth();
    setRetrying(false);
  };

  const handleSignIn = () => {
    clearAuthError();
    try { window.location.assign("/"); } catch { /* noop */ }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="auth-error-title"
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <h2 id="auth-error-title" className="text-lg font-bold text-foreground">
          {t.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
        {err.message ? (
          <p className="mt-3 text-[11px] font-mono text-muted-foreground/80 break-words">
            {err.source}{err.code ? ` · ${err.code}` : ""} — {err.message}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
            {t.retry}
          </button>
          <button
            type="button"
            onClick={handleSignIn}
            className="w-full h-11 rounded-xl border border-border bg-background text-foreground font-semibold flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            {t.login}
          </button>
        </div>
      </div>
    </div>
  );
}
