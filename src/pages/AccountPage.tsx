import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, CheckCheck, ChevronRight,
  Shield, Bell, Fingerprint, BarChart3, CreditCard,
  Gift, Lock, LogOut, BadgeCheck, AlertCircle,
  BellOff, Pencil, PlayCircle, Globe,
  MessageCircle, Mail, ClipboardList,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChangePinFlow from "@/components/ChangePinFlow";
import KycFlow from "@/components/KycFlow";
import ProfileEditFlow, { getDisplayPhoto } from "@/components/ProfileEditFlow";
import { useProfile } from "@/hooks/use-profile";
import SupportChat from "@/components/SupportChat";
import LimitsPage from "@/pages/LimitsPage";
import SpendingInsightsPage from "@/pages/SpendingInsightsPage";
import ReferPage from "@/pages/ReferPage";
import MyTicketsPage from "@/pages/MyTicketsPage";
import { generateWalletId } from "@/lib/walletId";
import { useI18n } from "@/lib/i18n";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";

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

type SubPage = "limits" | "insights" | "refer" | "tickets" | null;



const SESSION_KEY    = "mfs_authenticated";
const REGISTERED_KEY = "mfs_registered_phone";

const getRegisteredPhone = () => localStorage.getItem(REGISTERED_KEY) ?? "";

/* ─── KYC badge ─── */
const KycBadge = ({ verified }: { verified: boolean }) => {
  const { t } = useI18n();
  return verified ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/12 text-primary border border-primary/20">
      <BadgeCheck size={11} /> {t("verified")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
      <AlertCircle size={11} /> {t("unverified")}
    </span>
  );
};

/* ─── Section ─── */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1">
      {title}
    </p>
    <div className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden">
      {children}
    </div>
  </div>
);

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
  const [copied, setCopied]             = useState(false);
  const [biometric, setBiometric]       = useState(false);
  const [pushNotifs, setPushNotifs]     = useState(true);
  const [promoNotifs, setPromoNotifs]   = useState(true);
  const [twoFa, setTwoFa]               = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [showKyc, setShowKyc]           = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [subPage, setSubPage]           = useState<SubPage>(null);
  const [displayPhoto, setDisplayPhotoState] = useState(getDisplayPhoto);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const { roles } = useUserRoles();
  const { displayName } = useProfile();
  const registeredPhone = getRegisteredPhone();
  const walletId = useMemo(() => generateWalletId(registeredPhone || "WALLET_USER"), [registeredPhone]);

  // Fetch email from profile
  useEffect(() => {
    const fetchEmail = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", session.user.id)
        .single();
      if (data?.email) setUserEmail(data.email);
    };
    fetchEmail();
  }, []);
  if (subPage === "limits")   return <LimitsPage           onBack={() => setSubPage(null)} />;
  if (subPage === "insights") return <SpendingInsightsPage onBack={() => setSubPage(null)} />;
  if (subPage === "refer")    return <ReferPage            onBack={() => setSubPage(null)} />;
  if (subPage === "tickets")  return <MyTicketsPage        onBack={() => setSubPage(null)} />;

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
    setDisplayPhotoState(getDisplayPhoto());
    // Refresh email from DB
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", session.user.id)
        .single();
      setUserEmail(data?.email ?? null);
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
              {displayPhoto ? (
                <img src={displayPhoto} alt="Profile" className="w-16 h-16 rounded-2xl object-cover" />
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
                <KycBadge verified />
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
          <MenuRow icon={Pencil}    iconClass="gradient-hero"    label={t("editProfile")}      sub={t("updateNamePhoto")}      onClick={() => setShowProfileEdit(true)} />
          <MenuRow icon={BadgeCheck} iconClass="gradient-primary" label={t("kycVerification")} sub={t("kycSub")} onClick={() => setShowKyc(true)} />
          <MenuRow icon={Lock}       iconClass="gradient-send"    label={t("changePin")}        sub={t("changePinSub")}    onClick={() => setShowChangePin(true)} />
          <MenuRow icon={Gift}       iconClass="gradient-accent"  label={t("referAFriend")}   sub={t("referSub")} onClick={() => setSubPage("refer")} />
        </Section>

        {/* ── App Experience ── */}
        <Section title={t("sectionAppExperience")}>
          <MenuRow
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
          />
          <MenuRow
            icon={PlayCircle}
            iconClass="gradient-hero"
            label={t("viewOnboarding")}
            sub={t("viewOnboardingSub")}
            onClick={() => {
              localStorage.removeItem(ONBOARDING_KEY);
              toast.success(t("onboardingReset"));
              setTimeout(() => onReplayOnboarding?.(), 600);
            }}
          />
        </Section>

        {/* ── Insights & Limits ── */}
        <Section title={t("sectionInsightsLimits")}>
          <MenuRow icon={BarChart3}  iconClass="gradient-payment"  label={t("spendingInsights")} sub={t("insightsSub")}        onClick={() => setSubPage("insights")} />
          <MenuRow icon={CreditCard} iconClass="gradient-cashout"  label={t("limitsCharges")}  sub={t("limitsSub")}   onClick={() => setSubPage("limits")} />
        </Section>

        {/* ── Notifications ── */}
        <Section title={t("sectionNotifications")}>
          <ToggleRow icon={Bell}   iconClass="gradient-accent"  label={t("pushNotifications")} sub={t("pushSub")} checked={pushNotifs}  onCheckedChange={setPushNotifs} />
          <ToggleRow icon={BellOff} iconClass="gradient-payment" label={t("promotionalAlerts")} sub={t("promoAlertsSub")}     checked={promoNotifs} onCheckedChange={setPromoNotifs} />
        </Section>

        {/* ── Support & Help ── */}
        <Section title={t("sectionSupport")}>
          <MenuRow
            icon={MessageCircle}
            iconClass="gradient-primary"
            label={t("liveChat")}
            sub={t("liveChatSub")}
            onClick={() => setShowSupport(true)}
          />
          <MenuRow
            icon={Mail}
            iconClass="gradient-accent"
            label={t("emailUs")}
            sub="EasyPay@smartshop.bd"
            onClick={() => window.open("mailto:EasyPay@smartshop.bd?subject=Support%20Request", "_self")}
          />
          <MenuRow
            icon={ClipboardList}
            iconClass="gradient-cashout"
            label={t("myTickets")}
            sub={t("myTicketsSub")}
            onClick={() => setSubPage("tickets")}
          />
        </Section>

        {/* ── Security ── */}
        <Section title={t("sectionSecurity")}>
          <ToggleRow icon={Fingerprint} iconClass="gradient-send"    label={t("biometricLogin")}  sub={t("biometricSub")}   checked={biometric}   onCheckedChange={(v) => { setBiometric(v); toast.success(v ? t("biometricEnabled") : t("biometricDisabled")); }} />
          <ToggleRow icon={Shield}      iconClass="gradient-primary"  label={t("twoFactorAuth")}  sub={t("twoFactorSub")} checked={twoFa}       onCheckedChange={(v) => { setTwoFa(v); toast.success(v ? t("twoFaEnabled") : t("twoFaDisabled")); }} />
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

      {/* Live Chat Sheet */}
      <Sheet open={showSupport} onOpenChange={setShowSupport}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-6 pt-5 pb-3">
            <SheetTitle className="text-base">{t("liveChatTitle")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {userId ? (
              <SupportChat userId={userId} />
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
