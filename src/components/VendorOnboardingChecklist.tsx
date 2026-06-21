import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Check, Lock, Loader2, ChevronRight, ShieldCheck, FileText, BadgeCheck, Bell, Landmark, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useKycStatus } from "@/hooks/use-kyc-status";
import KycFlow from "@/components/KycFlow";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type StepStatus = "done" | "active" | "pending" | "in_review" | "locked" | "rejected";

interface StepDef {
  key: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  etaKey: TranslationKey;
  icon: LucideIcon;
  ctaKey: TranslationKey;
}

const STEPS: StepDef[] = [
  { key: "personal_kyc",  titleKey: "vocStep1Title", descKey: "vocStep1Desc", etaKey: "vocStep1Eta", icon: ShieldCheck, ctaKey: "vocStep1Cta" },
  { key: "submit_app",    titleKey: "vocStep2Title", descKey: "vocStep2Desc", etaKey: "vocStep2Eta", icon: FileText,    ctaKey: "vocStep2Cta" },
  { key: "approval",      titleKey: "vocStep3Title", descKey: "vocStep3Desc", etaKey: "vocStep3Eta", icon: BadgeCheck,  ctaKey: "vocStep3Cta" },
  { key: "bank",          titleKey: "vocStep4Title", descKey: "vocStep4Desc", etaKey: "vocStep4Eta", icon: Landmark,    ctaKey: "vocStep4Cta" },
  { key: "notifications", titleKey: "vocStep5Title", descKey: "vocStep5Desc", etaKey: "vocStep5Eta", icon: Bell,        ctaKey: "vocStep5Cta" },
];

interface Props {
  onApply: () => void;
}

export default function VendorOnboardingChecklist({ onApply }: Props) {
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const fmtNum = (n: number) => n.toLocaleString(locale);
  const tp = (key: TranslationKey, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce<string>((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), t(key));

  const { status: personalKycStatus, loading: kycLoading } = useKycStatus();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kycOpen, setKycOpen] = useState(false);

  const [appStatus, setAppStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [businessKycStatus, setBusinessKycStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [hasBank, setHasBank] = useState(false);
  const [hasPush, setHasPush] = useState(false);

  const [pendingSince, setPendingSince] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    const [appRes, merchRes, pushRes] = await Promise.all([
      supabase.from("merchant_applications").select("status").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("merchants").select("business_kyc_status, bank_account_number, created_at").eq("user_id", uid).maybeSingle(),
      supabase.from("push_subscriptions").select("id").eq("user_id", uid).limit(1),
    ]);

    const as = (appRes.data?.status as any) ?? "none";
    setAppStatus(["pending", "approved", "rejected"].includes(as) ? as : "none");

    const bs = (merchRes.data?.business_kyc_status as any) ?? "none";
    setBusinessKycStatus(["pending", "approved", "rejected"].includes(bs) ? bs : "none");
    setHasBank(!!merchRes.data?.bank_account_number);
    setPendingSince(bs === "pending" ? (merchRes.data?.created_at as string | null) ?? null : null);

    setHasPush((pushRes.data?.length ?? 0) > 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) { setLoading(false); return; }
      setUserId(session.user.id);
      await load(session.user.id);
    })();
    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`vendor-onboarding-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_applications", filter: `user_id=eq.${userId}` }, () => load(userId))
      .on("postgres_changes", { event: "*", schema: "public", table: "merchants", filter: `user_id=eq.${userId}` }, () => load(userId))
      .on("postgres_changes", { event: "*", schema: "public", table: "push_subscriptions", filter: `user_id=eq.${userId}` }, () => load(userId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const [eta, setEta] = useState<{ medianMin: number; p90Min: number; sample: number; isEstimate: boolean } | null>(null);
  const fetchEta = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_merchant_review_eta");
    if (error || !data) return;
    const d = data as any;
    setEta({
      medianMin: Number(d.median_minutes) || 1440,
      p90Min: Number(d.p90_minutes) || 2880,
      sample: Number(d.sample_size) || 0,
      isEstimate: !!d.is_estimate,
    });
  }, []);

  useEffect(() => { fetchEta(); }, [fetchEta]);

  useEffect(() => {
    const intv = setInterval(fetchEta, 5 * 60 * 1000);
    const channel = supabase
      .channel("vendor-onboarding-eta")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "merchants" }, (payload) => {
        const oldS = (payload.old as any)?.business_kyc_status;
        const newS = (payload.new as any)?.business_kyc_status;
        if (oldS !== "approved" && newS === "approved") fetchEta();
      })
      .subscribe();
    return () => { clearInterval(intv); supabase.removeChannel(channel); };
  }, [fetchEta]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);

  const fmtMinutes = (m: number) => {
    if (m < 60) return `${fmtNum(Math.max(1, Math.round(m)))}${t("vocMinUnit")}`;
    if (m < 60 * 24) return `${fmtNum(Math.round(m / 60))}${t("vocHourUnit")}`;
    return `${fmtNum(Math.round(m / (60 * 24)))}${t("vocDayUnit")}`;
  };
  const etaChipText = eta
    ? eta.isEstimate ? t("vocEtaEstimate") : tp("vocEtaTypical", { dur: fmtMinutes(eta.medianMin) })
    : t("vocEtaDefault");

  type ConfTier = "estimate" | "low" | "medium" | "high";
  const confidence: { tier: ConfTier; label: string; dotClass: string; chipClass: string; tip: string } = (() => {
    if (!eta || eta.isEstimate || eta.sample < 3) {
      return {
        tier: "estimate",
        label: t("vocConfEstimated"),
        dotClass: "bg-muted-foreground/60 animate-pulse",
        chipClass: "bg-muted text-muted-foreground border border-border/60",
        tip: t("vocTipEstimated"),
      };
    }
    if (eta.sample < 10) return {
      tier: "low", label: t("vocConfLow"),
      dotClass: "bg-rose-500",
      chipClass: "bg-rose-500/10 text-rose-700 border border-rose-500/30",
      tip: tp("vocTipLow", { n: fmtNum(eta.sample) }),
    };
    if (eta.sample < 30) return {
      tier: "medium", label: t("vocConfMedium"),
      dotClass: "bg-amber-500",
      chipClass: "bg-amber-500/10 text-amber-700 border border-amber-500/30",
      tip: tp("vocTipMedium", { n: fmtNum(eta.sample) }),
    };
    return {
      tier: "high", label: t("vocConfHigh"),
      dotClass: "bg-emerald-500",
      chipClass: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30",
      tip: tp("vocTipHigh", { n: fmtNum(eta.sample) }),
    };
  })();

  const elapsedMin = pendingSince ? Math.max(0, (now - new Date(pendingSince).getTime()) / 60000) : 0;
  const personalLine: { text: string; tone: "amber" | "muted" } | null = (() => {
    if (!eta || !pendingSince || businessKycStatus !== "pending") return null;
    if (elapsedMin < eta.medianMin) {
      const remaining = eta.medianMin - elapsedMin;
      return { text: tp("vocPersonalRemaining", { dur: fmtMinutes(remaining) }), tone: "amber" };
    }
    if (elapsedMin < eta.p90Min) {
      return { text: t("vocPersonalAlmost"), tone: "amber" };
    }
    return { text: t("vocPersonalDelay"), tone: "muted" };
  })();


  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      window.dispatchEvent(new CustomEvent("easypay:enable-push"));
    } catch {/* ignore */}
  };

  const statuses: StepStatus[] = useMemo(() => {
    const s: StepStatus[] = ["pending","pending","pending","pending","pending"];
    s[0] = personalKycStatus === "verified" ? "done"
         : personalKycStatus === "pending" ? "in_review"
         : personalKycStatus === "rejected" ? "rejected"
         : "active";
    const step1Done = s[0] === "done";

    s[1] = appStatus === "approved" || appStatus === "pending" || appStatus === "rejected"
         ? (appStatus === "rejected" ? "rejected" : "done")
         : (step1Done ? "active" : "locked");

    const step2Done = s[1] === "done";

    s[2] = businessKycStatus === "approved" ? "done"
         : businessKycStatus === "rejected" ? "rejected"
         : (step2Done ? "in_review" : "locked");

    const step3Done = s[2] === "done";

    s[3] = hasBank ? "done" : (step3Done ? "active" : "locked");
    s[4] = hasPush ? "done" : (step3Done ? "active" : "locked");
    return s;
  }, [personalKycStatus, appStatus, businessKycStatus, hasBank, hasPush]);

  const completed = statuses.filter(s => s === "done").length;
  const total = STEPS.length;
  const percent = Math.round((completed / total) * 100);

  const nextStepIdx = statuses.findIndex(s => s === "active" || s === "rejected");
  const nextLabel = nextStepIdx >= 0 ? t(STEPS[nextStepIdx].titleKey) : completed === total ? t("vocAllSet") : t("vocAwaitingReview");

  const pillFor = (st: StepStatus, n: number) => {
    if (st === "done") return { bg: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", node: <Check size={14} strokeWidth={3} /> };
    if (st === "active") return { bg: "bg-primary/15 text-primary border-primary/30 ring-2 ring-primary/20", node: <span className="text-[11px] font-black">{fmtNum(n)}</span> };
    if (st === "in_review") return { bg: "bg-amber-500/15 text-amber-600 border-amber-500/30", node: <Loader2 size={12} className="animate-spin" /> };
    if (st === "rejected") return { bg: "bg-destructive/15 text-destructive border-destructive/30", node: <span className="text-[11px] font-black">!</span> };
    return { bg: "bg-muted text-muted-foreground border-border/60", node: <Lock size={11} /> };
  };

  const C = 2 * Math.PI * 42;
  const dash = (percent / 100) * C;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="relative overflow-hidden border-0 shadow-elevated p-5 rounded-[19px]">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-15 pointer-events-none" style={{
            background: "radial-gradient(circle, hsl(24 90% 50%) 0%, transparent 70%)"
          }} />

          <div className="relative flex items-center gap-4">
            <div className="relative shrink-0 w-[100px] h-[100px]">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <defs>
                  <linearGradient id="vendor-ring" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(24 90% 50%)" />
                    <stop offset="100%" stopColor="hsl(350 65% 38%)" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="url(#vendor-ring)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={C}
                  initial={{ strokeDashoffset: C }}
                  animate={{ strokeDashoffset: C - dash }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-black text-foreground leading-none">{fmtNum(completed)}<span className="text-sm text-muted-foreground">/{fmtNum(total)}</span></p>
                <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">{t("vocComplete")}</p>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={12} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">{t("vocOnboarding")}</span>
              </div>
              <h3 className="text-base font-black text-foreground leading-tight mb-1">{t("vocTitle")}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t("vocNext")} <span className="font-semibold text-foreground">{(loading || kycLoading) ? t("vocLoading") : nextLabel}</span>
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {STEPS.map((step, idx) => {
                const st = statuses[idx];
                const pill = pillFor(st, idx + 1);
                const Icon = step.icon;
                const showCta = st === "active" || st === "rejected";
                const ctaLabel = st === "rejected"
                  ? (idx === 0 ? t("vocStep1Resubmit") : idx === 1 ? t("vocStep2Reapply") : t(step.ctaKey))
                  : t(step.ctaKey);

                const handleClick = () => {
                  if (idx === 0) setKycOpen(true);
                  else if (idx === 1) onApply();
                  else if (idx === 3) onApply();
                  else if (idx === 4) enableNotifications();
                };

                return (
                  <motion.div
                    key={step.key}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex items-center gap-3 rounded-[15px] p-3 border ${
                      st === "active" ? "border-primary/30 bg-primary/5"
                      : st === "rejected" ? "border-destructive/30 bg-destructive/5"
                      : st === "done" ? "border-emerald-500/20 bg-emerald-500/5"
                      : st === "in_review" ? "border-amber-500/20 bg-amber-500/5"
                      : "border-border/60 bg-muted/30"
                    }`}
                  >
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${pill.bg}`}>
                      {pill.node}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Icon size={12} className={st === "done" ? "text-emerald-600" : st === "locked" ? "text-muted-foreground/60" : "text-foreground"} />
                        <p className={`text-[13px] font-bold leading-tight ${st === "locked" ? "text-muted-foreground" : "text-foreground"}`}>
                          {t(step.titleKey)}
                        </p>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${
                            idx === 2 && st !== "done" && st !== "locked"
                              ? confidence.chipClass
                              : st === "done" ? "bg-emerald-500/10 text-emerald-700"
                              : st === "in_review" ? "bg-amber-500/10 text-amber-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                          title={idx === 2 && st !== "done" && st !== "locked" ? confidence.tip : undefined}
                        >
                          {idx === 2 && st !== "done" && st !== "locked" && (
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${confidence.dotClass}`} />
                          )}
                          {st === "done" ? t("vocDone")
                            : st === "in_review" ? t("vocInReview")
                            : st === "rejected" ? t("vocActionNeeded")
                            : idx === 2 ? etaChipText
                            : t(step.etaKey)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{t(step.descKey)}</p>
                      {idx === 2 && st === "in_review" && personalLine && (
                        <p className={`text-[10.5px] font-semibold mt-1 leading-tight ${personalLine.tone === "amber" ? "text-amber-700" : "text-muted-foreground"}`}>
                          {personalLine.text}
                        </p>
                      )}
                      {idx === 2 && eta && st !== "done" && st !== "locked" && (
                        <p className="text-[9.5px] text-muted-foreground/80 mt-0.5 inline-flex items-center gap-1">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${confidence.dotClass}`} />
                          <span className="font-semibold">{confidence.label}</span>
                          <span aria-hidden>•</span>
                          <span>{fmtNum(eta.sample)} {eta.sample === 1 ? t("vocApproval") : t("vocApprovals")}</span>
                        </p>
                      )}
                    </div>

                    {showCta && (
                      <Button
                        size="sm"
                        variant={st === "rejected" ? "destructive" : "default"}
                        onClick={handleClick}
                        className="shrink-0 h-8 px-3 text-[11px] gap-1 rounded-full"
                      >
                        {ctaLabel}
                        <ChevronRight size={12} />
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {completed === total && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="mt-4 rounded-[15px] p-3 border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 flex items-center gap-2"
            >
              <Check size={16} className="text-emerald-600" />
              <p className="text-xs font-bold text-emerald-700">{t("vocFullyOnboarded")}</p>
            </motion.div>
          )}
        </Card>
      </motion.div>

      {kycOpen && <KycFlow onClose={() => setKycOpen(false)} />}
    </>
  );
}
