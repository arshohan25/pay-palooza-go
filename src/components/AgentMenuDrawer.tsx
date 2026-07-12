import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Camera, QrCode, ShieldCheck, BarChart3, Bell,
  LogOut, ChevronRight, Building2, Upload, Activity,
  Users, Languages, ArrowDownToLine, ArrowRightLeft, Banknote,
  Receipt, UserPlus, History, Headphones, LayoutDashboard, CircleDollarSign,
  CheckCircle2, Clock, XCircle, ArrowUpRight, AlertTriangle, Search,
  RefreshCw, AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import UserQrModal from "@/components/UserQrModal";
import NotificationPreferences from "@/components/NotificationPreferences";
import { useI18n } from "@/lib/i18n";

interface AgentMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  agentInfo: {
    business_name: string | null;
    commission_earned: number;
    max_float: number;
    customers_onboarded: number;
    status: string;
    territory_code: string | null;
  } | null;
  recentTxns: any[];
}

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const AgentMenuDrawer = ({ open, onClose, agentInfo, recentTxns }: AgentMenuDrawerProps) => {
  const { user, signOut } = useAuth();
  const profile = useProfile();
  const navigate = useNavigate();
  const { isDisabled } = useGlobalToggles();
  const { t, lang, toggleLang } = useI18n();

  const [qrOpen, setQrOpen] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [kycSheetOpen, setKycSheetOpen] = useState(false);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  type KycCustomer = {
    user_id: string;
    name: string | null;
    phone: string | null;
    status: "verified" | "pending" | "rejected" | "none";
    rejection_reason: string | null;
    updated_at: string | null;
  };
  const [kycCustomers, setKycCustomers] = useState<KycCustomer[]>([]);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycLoaded, setKycLoaded] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [kycJustRefreshed, setKycJustRefreshed] = useState(false);
  const [kycModal, setKycModal] = useState<null | "verified" | "pending" | "rejected">(null);
  const [kycSearch, setKycSearch] = useState("");
  const [kycMainSearch, setKycMainSearch] = useState("");
  const [rejectionExpanded, setRejectionExpanded] = useState(false);

  // Retry cooldown so repeated fetch failures can't spam the backend.
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [retryCooldownUntil, setRetryCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const cooldownRemainingMs = Math.max(0, retryCooldownUntil - nowTick);
  const cooldownSeconds = Math.ceil(cooldownRemainingMs / 1000);
  const inCooldown = cooldownRemainingMs > 0;
  useEffect(() => {
    if (!inCooldown) return;
    const iv = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(iv);
  }, [inCooldown]);

  type KycAuditRow = {
    id: string;
    user_id: string;
    customer_name: string | null;
    customer_phone: string | null;
    previous_status: string | null;
    new_status: string;
    reviewer_notes: string | null;
    changed_by: string | null;
    changed_by_role: string | null;
    created_at: string;
  };
  const [kycAudit, setKycAudit] = useState<KycAuditRow[]>([]);
  const [kycAuditLoading, setKycAuditLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const kycCounts = useMemo(() => {
    const c = { verified: 0, pending: 0, rejected: 0, total: kycCustomers.length };
    kycCustomers.forEach((k) => {
      if (k.status === "verified") c.verified++;
      else if (k.status === "rejected") c.rejected++;
      else c.pending++;
    });
    return c;
  }, [kycCustomers]);

  const latestRejection = useMemo(() => {
    return kycCustomers
      .filter((k) => k.status === "rejected")
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))[0] || null;
  }, [kycCustomers]);

  // Cooldown schedule: 2s, 5s, 15s, 30s, 60s (capped) on successive failures.
  const cooldownForAttempt = (n: number) =>
    ({ 1: 2000, 2: 5000, 3: 15000, 4: 30000 }[n] ?? 60000);

  const fetchCustomerKyc = useCallback(async (opts?: { silent?: boolean; markRefresh?: boolean; manual?: boolean }) => {
    if (!user) return;
    // Reject manual retries while cooling down — prevents spamming the backend.
    if (opts?.manual && Date.now() < retryCooldownUntil) return;
    if (!opts?.silent) setKycLoading(true);
    setKycError(null);
    try {
      const { data, error } = await (supabase as any).rpc("get_agent_customer_kyc", { _agent_id: user.id });
      if (error) throw error;
      if (Array.isArray(data)) setKycCustomers(data as KycCustomer[]);
      setRetryAttempts(0);
      setRetryCooldownUntil(0);
      if (opts?.markRefresh) {
        setKycJustRefreshed(true);
        toast.success(lang === "bn" ? "গ্রাহক KYC আপডেট হয়েছে" : "Customer KYC updated");
        setTimeout(() => setKycJustRefreshed(false), 4000);
      }
    } catch (err: any) {
      const nextAttempt = retryAttempts + 1;
      setRetryAttempts(nextAttempt);
      setRetryCooldownUntil(Date.now() + cooldownForAttempt(nextAttempt));
      setKycError(err?.message || (lang === "bn" ? "লোড ব্যর্থ হয়েছে" : "Failed to load"));
    } finally {
      setKycLoading(false);
      setKycLoaded(true);
    }
  }, [user, lang, retryAttempts, retryCooldownUntil]);

  const fetchKycAudit = useCallback(async () => {
    if (!user) return;
    setKycAuditLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_agent_kyc_audit", { _agent_id: user.id, _limit: 25 });
      if (!error && Array.isArray(data)) setKycAudit(data as KycAuditRow[]);
    } finally {
      setKycAuditLoading(false);
    }
  }, [user]);

  // Fetch + realtime subscribe so counts update automatically.
  // Also clear any previous agent's data on user change to prevent leakage.
  useEffect(() => {
    setKycCustomers([]);
    setKycAudit([]);
    setKycLoaded(false);
    setKycError(null);
    setRejectionExpanded(false);
    setKycMainSearch("");
    setRetryAttempts(0);
    setRetryCooldownUntil(0);
    if (!user) { setKycLoading(false); return; }
    fetchCustomerKyc();
    const channel = supabase
      .channel(`agent-kyc-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals", filter: `referrer_id=eq.${user.id}` }, () => fetchCustomerKyc({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_verifications" }, () => { fetchCustomerKyc({ silent: true }); fetchKycAudit(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kyc_status_audit", filter: `agent_id=eq.${user.id}` }, () => fetchKycAudit())
      .subscribe();
    const onFocus = () => fetchCustomerKyc({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, fetchCustomerKyc, fetchKycAudit]);

  useEffect(() => {
    if (open) {
      fetchCustomerKyc({ silent: kycLoaded });
      fetchKycAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (kycSheetOpen) fetchKycAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kycSheetOpen]);




  // Avatar upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("agImageMax"));
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadAvatar = async () => {
    if (!fileRef.current?.files?.[0] || !user) return;
    setUploading(true);
    const file = fileRef.current.files[0];
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      toast.error(t("agUploadFailed"));
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("user_id", user.id);

    if (updateErr) {
      toast.error(t("agProfileUpdateFailed"));
    } else {
      toast.success(t("agAvatarUpdated"));
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: {} }));
    }
    setPreviewUrl(null);
    setAvatarSheetOpen(false);
    setUploading(false);
  };


  const openAfterClose = (fn: () => void) => {
    onClose();
    setTimeout(fn, 300);
  };

  const goto = (path: string) => { onClose(); navigate(path); };

  const accountItems = [
    { icon: Camera, label: t("agEditAvatar"), sub: lang === "bn" ? "প্রোফাইল ছবি আপডেট করুন" : "Update your profile photo", tint: "bg-blue-500/10 text-blue-500", action: () => openAfterClose(() => setAvatarSheetOpen(true)), toggleKey: "agent_edit_avatar" },
    { icon: QrCode, label: t("agShareQr"), sub: lang === "bn" ? "গ্রাহকদের সাথে QR শেয়ার করুন" : "Share your agent QR code", tint: "bg-violet-500/10 text-violet-500", action: () => openAfterClose(() => setQrOpen(true)), toggleKey: "agent_share_qr" },
    { icon: BarChart3, label: t("agAnalytics"), sub: lang === "bn" ? "কর্মক্ষমতা ও কমিশন দেখুন" : "View performance & commissions", tint: "bg-indigo-500/10 text-indigo-500", action: () => openAfterClose(() => navigate("/agent/analytics")), toggleKey: "agent_analytics" },
    { icon: ShieldCheck, label: t("agCustomerKyc"), sub: lang === "bn" ? "যাচাইকরণের স্ট্যাটাস দেখুন" : "Track verification status", tint: "bg-emerald-500/10 text-emerald-500", action: () => openAfterClose(() => setKycSheetOpen(true)), toggleKey: "agent_customer_kyc" },
    { icon: Bell, label: t("agNotifications"), sub: lang === "bn" ? "সতর্কতা পছন্দ ব্যবস্থাপনা" : "Manage alert preferences", tint: "bg-amber-500/10 text-amber-500", action: () => openAfterClose(() => setNotifSheetOpen(true)), toggleKey: "agent_notifications" },
  ].filter(item => !item.toggleKey || !isDisabled(item.toggleKey));



  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate("/");
    } finally {
      setSigningOut(false);
      setLogoutOpen(false);
    }
  };


  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="fixed top-0 left-0 bottom-0 w-[86vw] max-w-sm z-[71] bg-card shadow-float flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header with profile */}
              <div className="px-4 pt-4 pb-3 border-b border-border/50 bg-card">
                <div className="flex items-start justify-between mb-3">
                  <button
                    onClick={() => setAvatarSheetOpen(true)}
                    className="relative w-12 h-12 rounded-2xl overflow-hidden bg-muted flex items-center justify-center group shrink-0"
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={20} className="text-muted-foreground" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={14} className="text-white" />
                    </div>
                  </button>
                  <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <X size={15} />
                  </button>
                </div>
                <h3 className="text-sm font-bold text-foreground truncate">
                  {agentInfo?.business_name || t("agAgentPortal")}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className="bg-primary/10 text-primary border-0 text-[9px] px-1.5 py-0 font-semibold">
                    {agentInfo?.territory_code || "BD"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground capitalize">{agentInfo?.status || t("agActive")}</span>
                  <span className="text-[10px] text-muted-foreground truncate">· {profile.phone || "—"}</span>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">


                {/* Account */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                    {lang === "bn" ? "অ্যাকাউন্ট" : "Account"}
                  </p>
                  <div className="bg-muted/30 border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/40">
                    {accountItems.map(item => (
                      <button
                        key={item.label}
                        onClick={() => item.action()}
                        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/60 active:scale-[0.99] transition-all group text-left"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.tint}`}>
                          <item.icon size={15} strokeWidth={2.2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-foreground truncate leading-tight">{item.label}</p>
                          <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{item.sub}</p>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground/40 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>

                </div>


                {/* Preferences */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                    {lang === "bn" ? "পছন্দসমূহ" : "Preferences"}
                  </p>
                  <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Languages size={14} className="text-muted-foreground" />
                    </div>
                    <span className="text-[13px] font-semibold text-foreground flex-1 text-left truncate">{t("language")}</span>
                    <div className="relative flex items-center bg-muted/70 border border-border/60 rounded-full p-0.5 shrink-0">
                      <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 34 }}
                        className="absolute top-0.5 bottom-0.5 gradient-primary rounded-full shadow-glow"
                        style={{ width: "calc(50% - 2px)", left: lang === "en" ? 2 : "calc(50% + 0px)" }}
                      />
                      <button
                        onClick={() => lang !== "en" && toggleLang()}
                        className={`relative z-10 px-2.5 h-6 text-[10.5px] font-bold rounded-full transition-colors ${lang === "en" ? "text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => lang !== "bn" && toggleLang()}
                        className={`relative z-10 px-2.5 h-6 text-[10.5px] font-bold rounded-full transition-colors ${lang === "bn" ? "text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        বাং
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky bottom logout */}
              <div className="px-3 py-3 border-t border-border/50 bg-card">
                <button
                  onClick={() => setLogoutOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-destructive/8 hover:bg-destructive/15 active:scale-[0.99] transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                    <LogOut size={15} className="text-destructive" />
                  </div>
                  <span className="text-sm font-bold text-destructive flex-1 text-left">{t("agSignOut")}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <UserQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        userId={user?.id || ""}
        userName={agentInfo?.business_name || profile.displayName}
        phone={profile.phone || ""}
        role="agent"
        route={(agentInfo?.territory_code || "DH").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "DH"}
      />


      {/* Avatar Upload Sheet */}
      <Sheet open={avatarSheetOpen} onOpenChange={setAvatarSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-extrabold">{t("agChangeAvatar")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted flex items-center justify-center border-2 border-dashed border-border">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Current" className="w-full h-full object-cover" />
              ) : (
                <Camera size={32} className="text-muted-foreground" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} /> {t("agChoosePhoto")}
            </Button>
            {previewUrl && (
              <Button
                className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold"
                disabled={uploading}
                onClick={uploadAvatar}
              >
                {uploading ? t("agUploading") : t("agSaveAvatar")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Customer KYC Sheet */}
      <Sheet open={kycSheetOpen} onOpenChange={setKycSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8 max-h-[90vh] overflow-y-auto" data-testid="customer-kyc-sheet" aria-labelledby="customer-kyc-title">
          <SheetHeader className="mb-4">
            <SheetTitle id="customer-kyc-title" className="text-base font-extrabold">{t("agCustomerKycStatus")}</SheetTitle>
          </SheetHeader>

          {kycLoading && !kycLoaded ? (
            /* Loading state */
            <div className="space-y-4" data-testid="customer-kyc-loading" aria-busy="true">
              <Card className="p-5 border-0 shadow-card rounded-2xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-muted animate-pulse mb-3" />
                <div className="h-7 w-16 mx-auto bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-32 mx-auto bg-muted animate-pulse rounded" />
              </Card>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="h-16 rounded-xl bg-muted animate-pulse" />
                  <div className="h-16 rounded-xl bg-muted animate-pulse" />
                  <div className="h-16 rounded-xl bg-muted animate-pulse" />
                </div>
              </div>
            </div>
          ) : kycError && kycCustomers.length === 0 ? (
            /* Error state with retry + cooldown */
            <div className="space-y-4" data-testid="customer-kyc-error" role="alert" aria-live="assertive">
              <Card className="p-6 border-0 shadow-card rounded-2xl text-center bg-rose-500/[0.04] border border-rose-500/20">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 flex items-center justify-center mb-3" aria-hidden="true">
                  <AlertCircle size={24} className="text-rose-500" />
                </div>
                <p className="text-sm font-bold text-foreground">
                  {lang === "bn" ? "KYC ডেটা লোড করা যায়নি" : "Couldn't load KYC data"}
                </p>
                <p
                  id="kyc-error-desc"
                  className="text-[11px] text-muted-foreground mt-1 leading-snug break-words"
                  data-testid="kyc-error-message"
                >
                  {kycError}
                </p>
                <Button
                  data-testid="kyc-retry-btn"
                  onClick={() => fetchCustomerKyc({ manual: true })}
                  disabled={kycLoading || inCooldown}
                  aria-describedby="kyc-error-desc kyc-retry-cooldown"
                  aria-label={
                    inCooldown
                      ? (lang === "bn" ? `${cooldownSeconds} সেকেন্ডে আবার চেষ্টা করুন` : `Retry available in ${cooldownSeconds} seconds`)
                      : (lang === "bn" ? "KYC ডেটা পুনরায় লোড করুন" : "Retry loading KYC data")
                  }
                  className="mt-4 h-10 min-h-11 rounded-xl gradient-primary text-primary-foreground font-bold text-xs px-4 inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  <RefreshCw size={12} className={kycLoading ? "animate-spin" : ""} aria-hidden="true" />
                  {inCooldown
                    ? (lang === "bn" ? `আবার চেষ্টা করুন (${cooldownSeconds}s)` : `Retry (${cooldownSeconds}s)`)
                    : (lang === "bn" ? "আবার চেষ্টা করুন" : "Retry")}
                </Button>
                <p
                  id="kyc-retry-cooldown"
                  data-testid="kyc-retry-cooldown"
                  aria-live="polite"
                  className="mt-2 text-[10px] text-muted-foreground min-h-[14px]"
                >
                  {inCooldown
                    ? (lang === "bn"
                        ? `ব্যাকএন্ড সুরক্ষার জন্য অপেক্ষা করুন — ${cooldownSeconds} সেকেন্ড`
                        : `Waiting to avoid overloading the server — ${cooldownSeconds}s`)
                    : ""}
                </p>
              </Card>
            </div>

          ) : kycCounts.total === 0 ? (
            /* Empty state */
            <div className="space-y-4" data-testid="customer-kyc-empty">
              <Card className="p-6 border-0 shadow-card rounded-2xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Users size={24} className="text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">
                  {lang === "bn" ? "এখনো কোনো গ্রাহক নেই" : "No customers yet"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {lang === "bn"
                    ? "নতুন গ্রাহক নিবন্ধন করলে তাদের KYC স্ট্যাটাস এখানে দেখা যাবে।"
                    : "Register your first customer and their KYC status will appear here."}
                </p>
                <Button
                  onClick={() => { setKycSheetOpen(false); navigate("/agent/register"); }}
                  className="mt-4 h-10 rounded-xl gradient-primary text-primary-foreground font-bold text-xs px-4"
                >
                  {lang === "bn" ? "গ্রাহক নিবন্ধন করুন" : "Register a customer"}
                </Button>
              </Card>
            </div>
          ) : (
            <div className="space-y-4" data-testid="customer-kyc-content">
              {kycJustRefreshed && (
                <div
                  data-testid="kyc-updated-banner"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2"
                >
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" aria-hidden="true" />
                  <p className="text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {lang === "bn" ? "গ্রাহক KYC সফলভাবে আপডেট হয়েছে" : "Customer KYC updated successfully"}
                  </p>
                </div>
              )}


              <Card className="p-5 border-0 shadow-card rounded-2xl text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Users size={24} className="text-primary" />
                </div>
                <p className="text-3xl font-extrabold text-foreground" data-testid="kyc-total-count">{kycCounts.total}</p>
                <p className="text-xs text-muted-foreground font-semibold mt-1">{t("agCustomersOnboarded")}</p>
              </Card>

              {/* Customer KYC Status Summary */}
              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-emerald-500/[0.06] via-muted/20 to-amber-500/[0.06] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-foreground truncate">
                      {lang === "bn" ? "গ্রাহক KYC স্ট্যাটাস" : "Customer KYC Status"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {lang === "bn"
                        ? `মোট ${kycCounts.total} জন গ্রাহক`
                        : `${kycCounts.total} total customer${kycCounts.total === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <button
                    data-testid="kyc-update-btn"
                    onClick={() => {
                      setKycSheetOpen(false);
                      // Ensure counts refresh (with confirmation toast + inline banner)
                      // when the agent returns from the update flow.
                      const refresh = () => {
                        fetchCustomerKyc({ markRefresh: true });
                        window.removeEventListener("focus", refresh);
                      };
                      window.addEventListener("focus", refresh);
                      navigate("/agent/register");
                    }}
                    aria-label={lang === "bn" ? "গ্রাহক KYC আপডেট করুন" : "Update customer KYC"}
                    className="flex items-center gap-1 px-2.5 min-h-11 h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-[10.5px] font-bold shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {lang === "bn" ? "আপডেট" : "Update"}
                    <ArrowUpRight size={11} strokeWidth={2.5} aria-hidden="true" />
                  </button>

                </div>
                <TooltipProvider delayDuration={150}>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      data-testid="kyc-verified-tile"
                      onClick={() => { setKycSearch(""); setKycModal("verified"); }}
                      className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2 text-center hover:bg-emerald-500/15 active:scale-[0.98] transition-all"
                    >
                      <CheckCircle2 size={13} className="mx-auto text-emerald-500 mb-0.5" strokeWidth={2.4} />
                      <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 leading-none" data-testid="kyc-verified-count">{kycCounts.verified}</p>
                      <p className="text-[9px] text-muted-foreground font-semibold mt-0.5 truncate">
                        {lang === "bn" ? "যাচাইকৃত" : "Verified"}
                      </p>
                    </button>
                    <button
                      type="button"
                      data-testid="kyc-pending-tile"
                      onClick={() => { setKycSearch(""); setKycModal("pending"); }}
                      className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2 text-center hover:bg-amber-500/15 active:scale-[0.98] transition-all"
                    >
                      <Clock size={13} className="mx-auto text-amber-500 mb-0.5" strokeWidth={2.4} />
                      <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400 leading-none" data-testid="kyc-pending-count">{kycCounts.pending}</p>
                      <p className="text-[9px] text-muted-foreground font-semibold mt-0.5 truncate">
                        {lang === "bn" ? "অপেক্ষমাণ" : "Pending"}
                      </p>
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          data-testid="kyc-rejected-tile"
                          onClick={() => { setKycSearch(""); setKycModal("rejected"); }}
                          className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2 text-center hover:bg-rose-500/15 active:scale-[0.98] transition-all relative"
                        >
                          <XCircle size={13} className="mx-auto text-rose-500 mb-0.5" strokeWidth={2.4} />
                          <p className="text-sm font-extrabold text-rose-600 dark:text-rose-400 leading-none" data-testid="kyc-rejected-count">{kycCounts.rejected}</p>
                          <p className="text-[9px] text-muted-foreground font-semibold mt-0.5 truncate">
                            {lang === "bn" ? "প্রত্যাখ্যাত" : "Rejected"}
                          </p>
                        </button>
                      </TooltipTrigger>
                      {latestRejection && (
                        <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-snug">
                          <p className="font-bold mb-0.5">
                            {lang === "bn" ? "সর্বশেষ প্রত্যাখ্যানের কারণ" : "Latest rejection reason"}
                          </p>
                          <p className="text-muted-foreground">
                            {latestRejection.rejection_reason || (lang === "bn" ? "কোনো কারণ দেওয়া হয়নি" : "No reason provided")}
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </TooltipProvider>

                {latestRejection && kycCounts.rejected > 0 && (() => {
                  const reason = latestRejection.rejection_reason
                    || (lang === "bn" ? "কারণ উল্লেখ করা হয়নি" : "No reason provided");
                  const LONG = 120;
                  const isLong = reason.length > LONG;
                  const shown = !isLong || rejectionExpanded ? reason : reason.slice(0, LONG).trimEnd() + "…";
                  return (
                    <div
                      className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-500/8 border border-rose-500/20 px-2 py-1.5"
                      data-testid="kyc-latest-rejection"
                      data-expanded={rejectionExpanded ? "true" : "false"}
                      data-long={isLong ? "true" : "false"}
                    >
                      <AlertTriangle size={11} className="text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 leading-snug">
                          <span className="font-bold">
                            {lang === "bn" ? "সর্বশেষ কারণ: " : "Latest reason: "}
                          </span>
                          <span
                            id="kyc-latest-rejection-reason-text"
                            className={`text-muted-foreground break-words ${
                              isLong && !rejectionExpanded ? "line-clamp-2" : ""
                            }`}
                            data-testid="kyc-latest-rejection-reason"
                            title={isLong ? reason : undefined}
                          >
                            {shown}
                          </span>
                        </p>
                        {isLong && (
                          <button
                            type="button"
                            data-testid="kyc-rejection-toggle"
                            onClick={() => setRejectionExpanded((v) => !v)}
                            aria-expanded={rejectionExpanded}
                            aria-controls="kyc-latest-rejection-reason-text"
                            aria-label={
                              rejectionExpanded
                                ? (lang === "bn" ? "প্রত্যাখ্যানের কারণ কম দেখান" : "Show less of the rejection reason")
                                : (lang === "bn" ? "প্রত্যাখ্যানের কারণের সম্পূর্ণ পাঠ দেখান" : "Show the full rejection reason")
                            }
                            className="mt-1 min-h-[24px] px-1 -mx-1 text-[10px] font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                          >
                            {rejectionExpanded
                              ? (lang === "bn" ? "কম দেখান" : "Show less")
                              : (lang === "bn" ? "আরও দেখুন" : "Show more")}
                          </button>
                        )}
                      </div>
                    </div>

                  );
                })()}
              </div>

              {/* Search box — find any customer and see their current KYC status */}
              <div>
                <label htmlFor="kyc-main-search" className="sr-only">
                  {lang === "bn" ? "গ্রাহক খুঁজুন" : "Search customers"}
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="kyc-main-search"
                    data-testid="kyc-main-search"
                    value={kycMainSearch}
                    onChange={(e) => setKycMainSearch(e.target.value)}
                    placeholder={lang === "bn" ? "নাম বা ফোন দিয়ে খুঁজুন..." : "Find a customer by name or phone…"}
                    className="pl-9 h-10 rounded-xl text-sm"
                    autoComplete="off"
                  />
                </div>
                {kycMainSearch.trim() && (() => {
                  const q = kycMainSearch.trim().toLowerCase();
                  const results = kycCustomers
                    .filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q))
                    .slice(0, 8);
                  if (results.length === 0) {
                    return (
                      <p
                        data-testid="kyc-main-search-empty"
                        role="status"
                        aria-live="polite"
                        className="mt-2 text-[11px] text-muted-foreground text-center py-3"
                      >
                        {lang === "bn" ? "কোনো গ্রাহক পাওয়া যায়নি" : "No customers match your search"}
                      </p>
                    );
                  }
                  return (
                    <ul
                      data-testid="kyc-main-search-results"
                      aria-label={lang === "bn" ? "গ্রাহক অনুসন্ধান ফলাফল" : "Customer search results"}
                      className="mt-2 space-y-1 max-h-48 overflow-y-auto"
                    >
                      {results.map((c) => {
                        const status = c.status;
                        const badge =
                          status === "verified"
                            ? { cls: "bg-emerald-500/15 text-emerald-600", Icon: CheckCircle2, label: lang === "bn" ? "যাচাইকৃত" : "Verified" }
                            : status === "rejected"
                            ? { cls: "bg-rose-500/15 text-rose-600", Icon: XCircle, label: lang === "bn" ? "প্রত্যাখ্যাত" : "Rejected" }
                            : { cls: "bg-amber-500/15 text-amber-600", Icon: Clock, label: lang === "bn" ? "অপেক্ষমাণ" : "Pending" };
                        return (
                          <li key={c.user_id} className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border/50 px-2.5 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-bold text-foreground truncate">
                                {c.name || (lang === "bn" ? "নামহীন" : "Unnamed")}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">{c.phone || "—"}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                              <badge.Icon size={10} aria-hidden="true" />
                              {badge.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>

              {/* Audit log — who updated KYC, when, and previous → new status */}
              <section aria-labelledby="kyc-audit-heading" data-testid="kyc-audit-section">
                <h3 id="kyc-audit-heading" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                  {lang === "bn" ? "সাম্প্রতিক আপডেট" : "Recent KYC updates"}
                </h3>
                {kycAuditLoading && kycAudit.length === 0 ? (
                  <div className="space-y-1.5" data-testid="kyc-audit-loading" aria-busy="true">
                    <div className="h-12 rounded-xl bg-muted animate-pulse" />
                    <div className="h-12 rounded-xl bg-muted animate-pulse" />
                  </div>
                ) : kycAudit.length === 0 ? (
                  <p data-testid="kyc-audit-empty" className="text-[11px] text-muted-foreground text-center py-3">
                    {lang === "bn" ? "এখনও কোনো আপডেট নেই" : "No updates yet — status changes will appear here."}
                  </p>
                ) : (
                  <ul data-testid="kyc-audit-list" className="space-y-1.5 max-h-64 overflow-y-auto">
                    {kycAudit.map((row) => {
                      const who = row.changed_by_role === "admin"
                        ? (lang === "bn" ? "অ্যাডমিন" : "Admin")
                        : row.changed_by_role === "agent"
                        ? (lang === "bn" ? "আপনি (এজেন্ট)" : "You (agent)")
                        : row.changed_by_role === "system"
                        ? (lang === "bn" ? "সিস্টেম" : "System")
                        : (lang === "bn" ? "ব্যবহারকারী" : "User");
                      const when = new Date(row.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      });
                      return (
                        <li
                          key={row.id}
                          data-testid="kyc-audit-row"
                          className="rounded-xl bg-muted/30 border border-border/50 px-2.5 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-bold text-foreground truncate">
                              {row.customer_name || (lang === "bn" ? "নামহীন" : "Unnamed")}
                            </p>
                            <time
                              className="text-[10px] text-muted-foreground shrink-0"
                              dateTime={row.created_at}
                            >
                              {when}
                            </time>
                          </div>
                          <p className="text-[10.5px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                            <span className="font-semibold text-foreground">{who}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold capitalize">
                                {row.previous_status || (lang === "bn" ? "নতুন" : "new")}
                              </span>
                              <ArrowUpRight size={10} className="rotate-45" aria-label={lang === "bn" ? "থেকে" : "changed to"} />
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold capitalize ${
                                  row.new_status === "verified" ? "bg-emerald-500/15 text-emerald-600"
                                  : row.new_status === "rejected" ? "bg-rose-500/15 text-rose-600"
                                  : "bg-amber-500/15 text-amber-600"
                                }`}
                              >
                                {row.new_status}
                              </span>
                            </span>
                          </p>
                          {row.reviewer_notes && (
                            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                              {row.reviewer_notes}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <p className="text-[10px] text-muted-foreground text-center">
                {t("agKycTrackingSoon")}
              </p>

            </div>
          )}
        </SheetContent>
      </Sheet>


      {/* Notifications Preferences Sheet */}
      <Sheet open={notifSheetOpen} onOpenChange={setNotifSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="text-base font-bold">{t("agNotifPrefs")}</SheetTitle>
          </SheetHeader>
          <NotificationPreferences scope="agent" />
        </SheetContent>
      </Sheet>

      {/* Logout Confirmation */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("agSignOut")}?</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "bn"
                ? "আপনি কি নিশ্চিতভাবে সাইন আউট করতে চান? পুনরায় প্রবেশ করতে আপনাকে আবার লগইন করতে হবে।"
                : "Are you sure you want to sign out? You'll need to log in again to continue."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut} className="rounded-xl">
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={signingOut}
              onClick={(e) => { e.preventDefault(); handleLogout(); }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {signingOut ? (lang === "bn" ? "সাইন আউট হচ্ছে..." : "Signing out...") : t("agSignOut")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KYC Category Modal */}
      <Sheet open={kycModal !== null} onOpenChange={(o) => !o && setKycModal(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8 max-h-[85vh] overflow-hidden flex flex-col">
          <SheetHeader className="mb-3 text-left">
            <SheetTitle className="text-base font-extrabold flex items-center gap-2">
              {kycModal === "verified" && <CheckCircle2 size={16} className="text-emerald-500" />}
              {kycModal === "pending" && <Clock size={16} className="text-amber-500" />}
              {kycModal === "rejected" && <XCircle size={16} className="text-rose-500" />}
              {kycModal === "verified" && (lang === "bn" ? "যাচাইকৃত গ্রাহক" : "Verified Customers")}
              {kycModal === "pending" && (lang === "bn" ? "অপেক্ষমাণ গ্রাহক" : "Pending Customers")}
              {kycModal === "rejected" && (lang === "bn" ? "প্রত্যাখ্যাত গ্রাহক" : "Rejected Customers")}
            </SheetTitle>
          </SheetHeader>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={kycSearch}
              onChange={(e) => setKycSearch(e.target.value)}
              placeholder={lang === "bn" ? "নাম বা ফোন খুঁজুন..." : "Search by name or phone..."}
              className="pl-9 h-10 rounded-xl text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1.5">
            {(() => {
              const q = kycSearch.trim().toLowerCase();
              const list = kycCustomers
                .filter((c) => (kycModal === "verified" ? c.status === "verified" : kycModal === "rejected" ? c.status === "rejected" : c.status !== "verified" && c.status !== "rejected"))
                .filter((c) => !q || (c.name || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q))
                .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
              if (list.length === 0) {
                return (
                  <div className="text-center py-10 text-xs text-muted-foreground">
                    {lang === "bn" ? "কোনো গ্রাহক পাওয়া যায়নি" : "No customers found"}
                  </div>
                );
              }
              return list.map((c) => (
                <div key={c.user_id} className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    c.status === "verified" ? "bg-emerald-500/15 text-emerald-500" :
                    c.status === "rejected" ? "bg-rose-500/15 text-rose-500" :
                    "bg-amber-500/15 text-amber-500"
                  }`}>
                    {c.status === "verified" ? <CheckCircle2 size={15} /> : c.status === "rejected" ? <XCircle size={15} /> : <Clock size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-foreground truncate">{c.name || (lang === "bn" ? "নামহীন" : "Unnamed")}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.phone || "—"}</p>
                    {c.status === "rejected" && c.rejection_reason && (
                      <p className="text-[10.5px] text-rose-500 mt-1 leading-snug">
                        <AlertTriangle size={9} className="inline mr-1 -mt-0.5" />
                        {c.rejection_reason}
                      </p>
                    )}
                  </div>
                  {c.updated_at && (
                    <p className="text-[9.5px] text-muted-foreground shrink-0 mt-1">
                      {new Date(c.updated_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-BD", { day: "2-digit", month: "short" })}
                    </p>
                  )}
                </div>
              ));
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AgentMenuDrawer;
