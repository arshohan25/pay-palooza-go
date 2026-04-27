import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Check, Lock, Loader2, ChevronRight, ShieldCheck, FileText, BadgeCheck, Bell, Landmark, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useKycStatus } from "@/hooks/use-kyc-status";
import KycFlow from "@/components/KycFlow";

type StepStatus = "done" | "active" | "pending" | "in_review" | "locked" | "rejected";

interface StepDef {
  key: string;
  title: string;
  desc: string;
  eta: string;
  icon: LucideIcon;
  cta: string;
}

const STEPS: StepDef[] = [
  { key: "personal_kyc", title: "Verify your identity", desc: "Confirm your personal KYC to unlock business onboarding.", eta: "~3 min", icon: ShieldCheck, cta: "Complete KYC" },
  { key: "submit_app",   title: "Submit business application", desc: "Tell us about your shop and upload trade documents.", eta: "~5 min", icon: FileText, cta: "Apply as Vendor" },
  { key: "approval",     title: "Get approved by our team", desc: "We review applications within 24–48 hours on business days.", eta: "1–2 days", icon: BadgeCheck, cta: "Awaiting review" },
  { key: "bank",         title: "Add settlement bank account", desc: "Where we send your daily payouts after MDR.", eta: "~2 min", icon: Landmark, cta: "Add bank account" },
  { key: "notifications",title: "Turn on order notifications", desc: "Get instant alerts the moment a customer pays.", eta: "~30 sec", icon: Bell, cta: "Enable notifications" },
];

interface Props {
  onApply: () => void;
}

/**
 * Premium 5-step vendor onboarding checklist.
 * Completion is derived in real-time from existing DB tables — no shadow state.
 *
 * Source of truth per step:
 *  1 personal_kyc → profiles.kyc_status = 'verified'
 *  2 submit_app   → merchant_applications row exists for user
 *  3 approval     → merchants.business_kyc_status = 'approved'
 *  4 bank         → merchants.bank_account_number IS NOT NULL
 *  5 notifications→ push_subscriptions row exists for user
 */
export default function VendorOnboardingChecklist({ onApply }: Props) {
  const { status: personalKycStatus, loading: kycLoading } = useKycStatus();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kycOpen, setKycOpen] = useState(false);

  const [appStatus, setAppStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [businessKycStatus, setBusinessKycStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [hasBank, setHasBank] = useState(false);
  const [hasPush, setHasPush] = useState(false);

  const [pendingSince, setPendingSince] = useState<string | null>(null); // merchant.created_at when business_kyc_status='pending'

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

  // Realtime subscriptions on the source-of-truth tables
  // (personal KYC realtime is handled inside useKycStatus)
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

  // ── Real-time review-time ETA ─────────────────────────────────────────
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

  // Re-fetch every 5 minutes; also re-fetch whenever any merchant transitions to approved.
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

  // Tick every minute so the personalized countdown stays fresh
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);

  // Format minutes as a friendly duration
  const fmtMinutes = (m: number) => {
    if (m < 60) return `${Math.max(1, Math.round(m))}m`;
    if (m < 60 * 24) return `${Math.round(m / 60)}h`;
    return `${Math.round(m / (60 * 24))}d`;
  };
  const etaChipText = eta
    ? eta.isEstimate ? "1–2 days est." : `~${fmtMinutes(eta.medianMin)} typical`
    : "1–2 days";

  // Personalized countdown for the current pending application
  const elapsedMin = pendingSince ? Math.max(0, (now - new Date(pendingSince).getTime()) / 60000) : 0;
  const personalLine: { text: string; tone: "amber" | "muted" } | null = (() => {
    if (!eta || !pendingSince || businessKycStatus !== "pending") return null;
    if (elapsedMin < eta.medianMin) {
      const remaining = eta.medianMin - elapsedMin;
      return { text: `About ${fmtMinutes(remaining)} left on average`, tone: "amber" };
    }
    if (elapsedMin < eta.p90Min) {
      return { text: "Almost there — usually done by now", tone: "amber" };
    }
    return { text: "Taking longer than usual — we'll notify you the moment it's done", tone: "muted" };
  })();


  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      // Best-effort hint: a project-wide push subscription manager will create the push_subscriptions row.
      // The realtime listener above will refresh once it lands.
      window.dispatchEvent(new CustomEvent("easypay:enable-push"));
    } catch {/* ignore */}
  };

  // Derive per-step status
  const statuses: StepStatus[] = useMemo(() => {
    const s: StepStatus[] = ["pending","pending","pending","pending","pending"];
    // 1 personal kyc
    s[0] = personalKycStatus === "verified" ? "done"
         : personalKycStatus === "pending" ? "in_review"
         : personalKycStatus === "rejected" ? "rejected"
         : "active";
    // Gate downstream behind step 1
    const step1Done = s[0] === "done";

    // 2 submit application
    s[1] = appStatus === "approved" || appStatus === "pending" || appStatus === "rejected"
         ? (appStatus === "rejected" ? "rejected" : "done")
         : (step1Done ? "active" : "locked");

    const step2Done = s[1] === "done";

    // 3 approval
    s[2] = businessKycStatus === "approved" ? "done"
         : businessKycStatus === "rejected" ? "rejected"
         : (step2Done ? "in_review" : "locked");

    const step3Done = s[2] === "done";

    // 4 bank
    s[3] = hasBank ? "done" : (step3Done ? "active" : "locked");
    // 5 notifications
    s[4] = hasPush ? "done" : (step3Done ? "active" : "locked");
    return s;
  }, [personalKycStatus, appStatus, businessKycStatus, hasBank, hasPush]);

  const completed = statuses.filter(s => s === "done").length;
  const total = STEPS.length;
  const percent = Math.round((completed / total) * 100);

  const nextStepIdx = statuses.findIndex(s => s === "active" || s === "rejected");
  const nextLabel = nextStepIdx >= 0 ? STEPS[nextStepIdx].title : completed === total ? "All set!" : "Awaiting review";

  // Visual config for status pill
  const pillFor = (st: StepStatus, n: number) => {
    if (st === "done") return { bg: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", node: <Check size={14} strokeWidth={3} /> };
    if (st === "active") return { bg: "bg-primary/15 text-primary border-primary/30 ring-2 ring-primary/20", node: <span className="text-[11px] font-black">{n}</span> };
    if (st === "in_review") return { bg: "bg-amber-500/15 text-amber-600 border-amber-500/30", node: <Loader2 size={12} className="animate-spin" /> };
    if (st === "rejected") return { bg: "bg-destructive/15 text-destructive border-destructive/30", node: <span className="text-[11px] font-black">!</span> };
    return { bg: "bg-muted text-muted-foreground border-border/60", node: <Lock size={11} /> };
  };

  // Circumference for progress ring (r=42 → 2πr ≈ 263.89)
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
          {/* Decorative orb */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-15 pointer-events-none" style={{
            background: "radial-gradient(circle, hsl(24 90% 50%) 0%, transparent 70%)"
          }} />

          {/* Header: ring + title */}
          <div className="relative flex items-center gap-4">
            {/* Progress ring */}
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
                <p className="text-xl font-black text-foreground leading-none">{completed}<span className="text-sm text-muted-foreground">/{total}</span></p>
                <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">complete</p>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={12} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Onboarding</span>
              </div>
              <h3 className="text-base font-black text-foreground leading-tight mb-1">Become a Vendor in 5 steps</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Next: <span className="font-semibold text-foreground">{(loading || kycLoading) ? "Loading…" : nextLabel}</span>
              </p>
            </div>
          </div>

          {/* Step list */}
          <div className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {STEPS.map((step, idx) => {
                const st = statuses[idx];
                const pill = pillFor(st, idx + 1);
                const Icon = step.icon;
                const showCta = st === "active" || st === "rejected";
                const ctaLabel = st === "rejected" ? (idx === 0 ? "Resubmit KYC" : idx === 1 ? "Reapply" : step.cta) : step.cta;

                const handleClick = () => {
                  if (idx === 0) setKycOpen(true);
                  else if (idx === 1) onApply();
                  else if (idx === 3) onApply(); // bank captured inside business KYC flow
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
                          {step.title}
                        </p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                          st === "done" ? "bg-emerald-500/10 text-emerald-700"
                          : st === "in_review" ? "bg-amber-500/10 text-amber-700"
                          : "bg-muted text-muted-foreground"
                        }`}>
                          {st === "done" ? "Done" : st === "in_review" ? "In review" : st === "rejected" ? "Action needed" : step.eta}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{step.desc}</p>
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
              <p className="text-xs font-bold text-emerald-700">You're fully onboarded — your dashboard is ready.</p>
            </motion.div>
          )}
        </Card>
      </motion.div>

      {kycOpen && <KycFlow onClose={() => setKycOpen(false)} />}
    </>
  );
}
