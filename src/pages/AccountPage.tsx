import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, CheckCheck, ChevronRight,
  Shield, Bell, Fingerprint, BarChart3, CreditCard,
  Gift, Lock, LogOut, BadgeCheck, AlertCircle, Clock,
  BellOff, Pencil, PlayCircle, Globe,
  MessageCircle, Mail, ClipboardList, ShieldBan, GripVertical,
  Sun, Grid3X3, Minimize2, Store,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChangePinFlow from "@/components/ChangePinFlow";
import KycFlow from "@/components/KycFlow";
import ProfileEditFlow from "@/components/ProfileEditFlow";
import { useProfile } from "@/hooks/use-profile";
import SupportChat from "@/components/SupportChat";
import LimitsPage from "@/pages/LimitsPage";
import SpendingInsightsPage from "@/pages/SpendingInsightsPage";
import ReferPage from "@/pages/ReferPage";
import MyTicketsPage from "@/pages/MyTicketsPage";
import BlockedUsersPage from "@/components/BlockedUsersPage";
import MerchantApplicationFlow from "@/components/MerchantApplicationFlow";
import FundRequestHistory from "@/components/FundRequestHistory";
import { generateWalletId } from "@/lib/walletId";
import { useI18n } from "@/lib/i18n";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useCustomization } from "@/hooks/use-customization";
import { useKycStatus, KycStatus } from "@/hooks/use-kyc-status";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { useMerchantApplyAccess } from "@/hooks/use-merchant-apply-access";

const ROLE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  customer:          { label: "Customer",          bg: "bg-primary/10",      text: "text-primary" },
  admin:             { label: "Admin",             bg: "bg-destructive/10",  text: "text-destructive" },
  agent:             { label: "Agent",             bg: "bg-[hsl(122_38%_50%)]/12", text: "text-[hsl(122_38%_50%)]" },
  merchant:          { label: "Merchant",          bg: "bg-[hsl(291_64%_44%)]/12", text: "text-[hsl(291_64%_44%)]" },
  distributor:       { label: "Distributor",       bg: "bg-[hsl(217_80%_50%)]/12", text: "text-[hsl(217_80%_50%)]" },
  super_distributor: { label: "Super Distributor", bg: "bg-accent/12",       text: "text-accent" },
  compliance:        { label: "Compliance",        bg: "bg-muted",           text: "text-muted-foreground" },
  finance:           { label: "Finance",           bg: "bg-muted",           text: "text-muted-foreground" },
};

const ONBOARDING_KEY = "mfs_onboarding_done";

type SubPage = "limits" | "insights" | "refer" | "tickets" | "blocked" | "requests" | null;



const SESSION_KEY    = "mfs_authenticated";
const REGISTERED_KEY = "mfs_registered_phone";

const getRegisteredPhone = () => localStorage.getItem(REGISTERED_KEY) ?? "";

/* ─── KYC badge ─── */
const KycBadge = ({ status, loading }: { status: KycStatus; loading?: boolean }) => {
  const { t } = useI18n();
  if (loading) return <Skeleton className="w-16 h-4 rounded-full" />;
  if (status === "verified") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/12 text-primary border border-primary/20">
      <BadgeCheck size={11} /> {t("verified")}
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-600 border border-amber-500/20">
      <Clock size={11} /> {t("kycPending")}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
      <AlertCircle size={11} /> {t("unverified")}
    </span>
  );
};

/* ─── Section — auto-hides when all children are hidden ─── */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  // Filter out falsy children (hidden by toggles)
  const validChildren = Array.isArray(children)
    ? children.filter(Boolean)
    : children ? [children] : [];
  if (validChildren.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1">
        {title}
      </p>
      <div className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden">
        {validChildren}
      </div>
    </div>
  );
};

/* ─── Menu Row ─── */
const MenuRow = ({
  icon: Icon, iconClass = "gradient-primary", label, sub, right, onClick, danger,
}: {
  icon: React.ElementType; iconClass?: string; label: string; sub?: string;
  right?: React.ReactNode; onClick?: () => void; danger?: boolean;
}) => (
  <motion.button
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    className="w-full flex items-center gap-3.5 px-4 py-4 hover:bg-muted/40 active:bg-muted/60 transition-colors border-b border-border/50 last:border-0 group"
  >
    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-primary-foreground shrink-0 ${iconClass} shadow-xs`}>
      <Icon size={16} strokeWidth={2.2} />
    </div>
    <div className="flex-1 text-left min-w-0">
      <p className={`text-[13.5px] font-semibold truncate ${danger ? "text-destructive" : "text-foreground"}`}>
        {label}
      </p>
      {sub && <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">{sub}</p>}
    </div>
    {right ?? (
      <ChevronRight size={15} className="text-muted-foreground/60 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
    )}
  </motion.button>
);

/* ─── Toggle Row ─── */
const ToggleRow = ({
  icon: Icon, iconClass = "gradient-primary", label, sub, checked, onCheckedChange,
}: {
  icon: React.ElementType; iconClass?: string; label: string; sub?: string;
  checked: boolean; onCheckedChange: (v: boolean) => void;
}) => (
  <div className="w-full flex items-center gap-3.5 px-4 py-4 border-b border-border/50 last:border-0">
    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-primary-foreground shrink-0 ${iconClass} shadow-xs`}>
      <Icon size={16} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[13.5px] font-semibold text-foreground truncate">{label}</p>
      {sub && <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">{sub}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

/* ─── Main ─── */
interface AccountPageProps { onSignOut?: () => void; onReplayOnboarding?: () => void; }

const AccountPage = ({ onSignOut, onReplayOnboarding }: AccountPageProps) => {
  const { t, lang, toggleLang } = useI18n();
  const { status: kycStatus, loading: kycLoading } = useKycStatus();
  const [copied, setCopied]             = useState(false);
  const [biometric, setBiometric]       = useState(false);
  const [pushNotifs, setPushNotifs]     = useState(true);
  const [promoNotifs, setPromoNotifs]   = useState(true);
  const [twoFa, setTwoFa]               = useState(false);
  const [dndEnabled, setDndEnabled]     = useState(() => localStorage.getItem("mfs_dnd_enabled") === "true");
  const [showChangePin, setShowChangePin] = useState(false);
  const [showKyc, setShowKyc]           = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [subPage, setSubPage]           = useState<SubPage>(null);
  const [displayPhoto, setDisplayPhotoState] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [showMerchantApp, setShowMerchantApp] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [myRewards, setMyRewards] = useState<{ id: string; reward_type: string; reward_value: any; reason: string | null; status: string }[]>([]);
  const [chatDraft, setChatDraft] = useState<string | undefined>(undefined);
  const [chatContext, setChatContext] = useState<{ title: string; body: string } | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Auto-open Live Chat when navigated here with ?openChat=1 (e.g. from the Merchant API access gate)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("openChat") === "1") {
      const prefill = params.get("prefill");
      if (prefill) {
        try { setChatDraft(decodeURIComponent(prefill)); } catch { setChatDraft(prefill); }
      }
      const ctxTitle = params.get("contextTitle");
      const ctxBody = params.get("contextBody");
      if (ctxTitle && ctxBody) {
        try {
          setChatContext({ title: decodeURIComponent(ctxTitle), body: decodeURIComponent(ctxBody) });
        } catch {
          setChatContext({ title: ctxTitle, body: ctxBody });
        }
      }
      setShowSupport(true);
      // Strip query params so they don't re-trigger on back/forward navigation
      params.delete("openChat");
      params.delete("prefill");
      params.delete("contextTitle");
      params.delete("contextBody");
      const next = params.toString();
      navigate(`${location.pathname}${next ? `?${next}` : ""}`, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  const { roles } = useUserRoles();
  const { displayName, avatar_url } = useProfile();
  const { isDisabled } = useGlobalToggles();
  const { canApply: canMerchantApply, loading: merchantApplyLoading } = useMerchantApplyAccess();
  const {
    theme: currentTheme, cycleTheme, themeLabel,
    iconSize, iconSizeLabel, cycleIconSize,
    gridLayout, cycleGridLayout,
    compactMode, setCompactMode,
  } = useCustomization();
  const registeredPhone = getRegisteredPhone();
  const walletId = useMemo(() => generateWalletId(registeredPhone || "WALLET_USER"), [registeredPhone]);

  // Fetch email + rewards from profile
  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      const [{ data: profileData }, { data: rewardData }] = await Promise.all([
        supabase.from("profiles").select("email").eq("user_id", session.user.id).single(),
        (supabase.from as any)("user_rewards").select("id, reward_type, reward_value, reason, status").eq("user_id", session.user.id).eq("status", "active"),
      ]);
      if (profileData?.email) setUserEmail(profileData.email);
      if (rewardData) setMyRewards(rewardData);
    };
    fetchData();
  }, []);
  if (subPage === "limits")   return <LimitsPage           onBack={() => setSubPage(null)} />;
  if (subPage === "insights") return <SpendingInsightsPage onBack={() => setSubPage(null)} />;
  if (subPage === "refer")    return <ReferPage            onBack={() => setSubPage(null)} />;
  if (subPage === "tickets")  return <MyTicketsPage        onBack={() => setSubPage(null)} />;
  if (subPage === "blocked")  return <BlockedUsersPage    onBack={() => setSubPage(null)} />;
  if (subPage === "requests") return <FundRequestHistory  onBack={() => setSubPage(null)} />;

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(walletId); }
    catch {
      const el = document.createElement("textarea");
      el.value = walletId; document.body.appendChild(el);
      el.select(); document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t("walletIdCopied"));
  };

  const handleProfileSaved = async () => {
    // Refresh email and avatar from DB
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from("profiles")
        .select("email, avatar_url")
        .eq("user_id", session.user.id)
        .single();
      setUserEmail(data?.email ?? null);
      setDisplayPhotoState(data?.avatar_url ?? null);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="space-y-5 pb-6"
      >
        {/* ── Profile card ── */}
        <div className="relative overflow-hidden gradient-hero rounded-3xl p-5 sm:p-6 text-primary-foreground shadow-glow-lg">
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/6 pointer-events-none" />
          <div className="absolute -bottom-10 left-4 w-32 h-32 rounded-full bg-white/4 pointer-events-none" />

          <div className="relative flex items-center gap-4">
            <button
              onClick={() => setShowProfileEdit(true)}
              className="relative w-16 h-16 rounded-2xl shrink-0 group active:scale-95 transition-transform"
            >
              {(avatar_url || displayPhoto) ? (
                <img src={avatar_url || displayPhoto || ""} alt="Profile" className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl glass-hero flex items-center justify-center text-2xl font-bold text-white">
                  {displayName[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
                <Pencil size={16} className="text-white" />
              </div>
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[17px] font-bold">{displayName}</p>
                <KycBadge status={kycStatus} loading={kycLoading} />
              </div>
              <p className="text-[13px] opacity-80 mt-0.5 font-medium">{registeredPhone ? `+88 ${registeredPhone}` : "—"}</p>
              {userEmail && (
                <p className="text-[11px] opacity-55 truncate">{userEmail}</p>
              )}
            </div>
          </div>

          {/* Wallet ID */}
          <div className="relative mt-5 pt-4 border-t border-white/15 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] opacity-50 mb-0.5">{t("walletId")}</p>
              <p className="text-[13px] font-mono font-bold tracking-widest opacity-90">{walletId}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleCopy}
              className="glass-hero w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/25 transition-colors tap-target"
              title={t("copyId")}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? "check" : "copy"}
                  initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.16 }}
                >
                  {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* ── Account ── */}
        <Section title={t("sectionAccount")}>
          {!isDisabled("account_edit_profile") && <MenuRow icon={Pencil}    iconClass="gradient-hero"    label={t("editProfile")}      sub={t("updateNamePhoto")}      onClick={() => setShowProfileEdit(true)} />}
          {!isDisabled("account_kyc") && <MenuRow icon={BadgeCheck} iconClass="gradient-primary" label={t("kycVerification")} sub={t("kycSub")} onClick={() => setShowKyc(true)} />}
          {!isDisabled("account_change_pin") && <MenuRow icon={Lock}       iconClass="gradient-send"    label={t("changePin")}        sub={t("changePinSub")}    onClick={() => setShowChangePin(true)} />}
          {!isDisabled("account_refer") && <MenuRow icon={Gift}       iconClass="gradient-accent"  label={t("referAFriend")}   sub={t("referSub")} onClick={() => setSubPage("refer")} />}
          {!isDisabled("account_become_merchant") && !merchantApplyLoading && canMerchantApply && (
            <MenuRow icon={Store} iconClass="gradient-payment" label={t("becomeMerchant")} sub={t("becomeMerchantSub")} onClick={() => setShowMerchantApp(true)} />
          )}
        </Section>

        {/* ── App Experience ── */}
        <Section title={t("sectionAppExperience")}>
          {!isDisabled("account_language") && <MenuRow
            icon={Globe}
            iconClass="gradient-payment"
            label={t("language")}
            sub={t("languageSub")}
            right={
              <span className="text-[12px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl">
                {lang === "en" ? "English" : "বাংলা"}
              </span>
            }
            onClick={toggleLang}
          />}
          {!isDisabled("account_theme") && <MenuRow
            icon={Sun}
            iconClass="gradient-accent"
            label={t("theme")}
            sub={t("themeSub")}
            right={
              <span className="text-[12px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl">
                {themeLabel}
              </span>
            }
            onClick={cycleTheme}
          />}
          {!isDisabled("account_icon_size") && <MenuRow
            icon={Grid3X3}
            iconClass="gradient-cashout"
            label="Icon Size"
            sub="Adjust Quick Action icon size"
            right={
              <span className="text-[12px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl">
                {iconSizeLabel}
              </span>
            }
            onClick={cycleIconSize}
          />}
          {!isDisabled("account_grid_layout") && <MenuRow
            icon={Grid3X3}
            iconClass="gradient-primary"
            label="Grid Layout"
            sub="Change Quick Actions grid arrangement"
            right={
              <span className="text-[12px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl">
                {gridLayout}
              </span>
            }
            onClick={cycleGridLayout}
          />}
          {!isDisabled("account_compact_mode") && <ToggleRow
            icon={Minimize2}
            iconClass="gradient-hero"
            label="Compact Mode"
            sub="Reduce spacing for more content"
            checked={compactMode}
            onCheckedChange={(v) => {
              setCompactMode(v);
              toast.success(v ? "Compact mode enabled" : "Compact mode disabled");
            }}
          />}
          {!isDisabled("account_rearrange_actions") && <ToggleRow
            icon={GripVertical}
            iconClass="gradient-send"
            label="Rearrange Quick Actions"
            sub="Enable drag & drop to customize icon order"
            checked={dndEnabled}
            onCheckedChange={(v) => {
              setDndEnabled(v);
              localStorage.setItem("mfs_dnd_enabled", String(v));
              toast.success(v ? "Drag & drop enabled" : "Drag & drop disabled");
            }}
          />}
          {!isDisabled("account_onboarding") && <MenuRow
            icon={PlayCircle}
            iconClass="gradient-hero"
            label={t("viewOnboarding")}
            sub={t("viewOnboardingSub")}
            onClick={() => {
              localStorage.removeItem(ONBOARDING_KEY);
              toast.success(t("onboardingReset"));
              setTimeout(() => onReplayOnboarding?.(), 600);
            }}
          />}
        </Section>

        {/* ── My Rewards ── */}
        {myRewards.length > 0 && (
          <Section title="My Rewards">
            {myRewards.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center text-white">
                  <Gift className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium capitalize">{r.reward_type.replace("_", " ")}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.reason ?? JSON.stringify(r.reward_value)}</p>
                </div>
                <Badge variant={r.status === "active" ? "default" : "secondary"} className="text-[10px]">{r.status}</Badge>
              </div>
            ))}
          </Section>
        )}

        {/* ── Insights & Limits ── */}
        <Section title={t("sectionInsightsLimits")}>
          {!isDisabled("account_spending_insights") && <MenuRow icon={BarChart3}  iconClass="gradient-payment"  label={t("spendingInsights")} sub={t("insightsSub")}        onClick={() => setSubPage("insights")} />}
          {!isDisabled("account_limits_charges") && <MenuRow icon={CreditCard} iconClass="gradient-cashout"  label={t("limitsCharges")}  sub={t("limitsSub")}   onClick={() => setSubPage("limits")} />}
          
        </Section>

        {/* ── Notifications ── */}
        <Section title={t("sectionNotifications")}>
          {!isDisabled("account_push_notifications") && <ToggleRow icon={Bell}   iconClass="gradient-accent"  label={t("pushNotifications")} sub={t("pushSub")} checked={pushNotifs}  onCheckedChange={setPushNotifs} />}
          {!isDisabled("account_promo_alerts") && <ToggleRow icon={BellOff} iconClass="gradient-payment" label={t("promotionalAlerts")} sub={t("promoAlertsSub")}     checked={promoNotifs} onCheckedChange={setPromoNotifs} />}
        </Section>

        {/* ── Support & Help ── */}
        <Section title={t("sectionSupport")}>
          {!isDisabled("account_live_chat") && <MenuRow
            icon={MessageCircle}
            iconClass="gradient-primary"
            label={t("liveChat")}
            sub={t("liveChatSub")}
            onClick={() => setShowSupport(true)}
          />}
          {!isDisabled("account_email_support") && <MenuRow
            icon={Mail}
            iconClass="gradient-accent"
            label={t("emailUs")}
            sub="EasyPay@smartshop.bd"
            onClick={() => window.open("mailto:EasyPay@smartshop.bd?subject=Support%20Request", "_self")}
          />}
          {!isDisabled("account_my_tickets") && <MenuRow
            icon={ClipboardList}
            iconClass="gradient-cashout"
            label={t("myTickets")}
            sub={t("myTicketsSub")}
            onClick={() => setSubPage("tickets")}
          />}
        </Section>

        {/* ── Security ── */}
        <Section title={t("sectionSecurity")}>
          {!isDisabled("account_biometric") && <ToggleRow icon={Fingerprint} iconClass="gradient-send"    label={t("biometricLogin")}  sub={t("biometricSub")}   checked={biometric}   onCheckedChange={(v) => { setBiometric(v); toast.success(v ? t("biometricEnabled") : t("biometricDisabled")); }} />}
          {!isDisabled("account_2fa") && <ToggleRow icon={Shield}      iconClass="gradient-primary"  label={t("twoFactorAuth")}  sub={t("twoFactorSub")} checked={twoFa}       onCheckedChange={(v) => { setTwoFa(v); toast.success(v ? t("twoFaEnabled") : t("twoFaDisabled")); }} />}
          {!isDisabled("account_blocked_users") && <MenuRow icon={ShieldBan} iconClass="bg-destructive/80" label="Blocked Users" sub="Manage blocked accounts" onClick={() => setSubPage("blocked")} />}
        </Section>

        {/* ── Sign Out ── */}
        <Section title={t("sectionAccountActions")}>
          <MenuRow
            icon={LogOut}
            iconClass="bg-destructive"
            label={t("signOut")}
            sub={registeredPhone ? `${t("signedInAs")} +88 ${registeredPhone}` : t("signOutAccount")}
            danger
            right={<span />}
            onClick={() => {
              sessionStorage.removeItem(SESSION_KEY);
              onSignOut?.();
            }}
          />
        </Section>

        <p className="text-center text-[11px] text-muted-foreground pt-1 pb-2">
          EasyPay v1.0.0 · Built with ❤️
        </p>
      </motion.div>

      {showChangePin && <ChangePinFlow onClose={() => setShowChangePin(false)} />}
      {showKyc && <KycFlow onClose={() => setShowKyc(false)} />}
      {showProfileEdit && (
        <ProfileEditFlow
          onClose={() => setShowProfileEdit(false)}
          onSaved={handleProfileSaved}
        />
      )}
      <MerchantApplicationFlow open={showMerchantApp} onOpenChange={setShowMerchantApp} />

      {/* Live Chat Sheet */}
      <Sheet open={showSupport} onOpenChange={setShowSupport}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[92dvh] sm:h-[85vh] flex flex-col p-0 gap-0">
          <SheetHeader className="px-4 sm:px-6 pt-4 pb-2 shrink-0">
            <SheetTitle className="text-base">{t("liveChatTitle")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            {userId ? (
              <SupportChat userId={userId} initialDraft={chatDraft} initialContext={chatContext} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                {t("signInToContact")}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

    </>
  );
};

export default AccountPage;
