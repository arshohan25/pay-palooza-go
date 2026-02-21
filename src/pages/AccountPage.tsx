import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, CheckCheck, ChevronRight,
  Shield, Bell, Fingerprint, BarChart3, CreditCard,
  Gift, Lock, LogOut, BadgeCheck, AlertCircle,
  BellOff, Pencil, PlayCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ChangePinFlow from "@/components/ChangePinFlow";
import KycFlow from "@/components/KycFlow";
import ProfileEditFlow, { getDisplayName, getDisplayPhoto } from "@/components/ProfileEditFlow";
import LimitsPage from "@/pages/LimitsPage";
import SpendingInsightsPage from "@/pages/SpendingInsightsPage";
import ReferPage from "@/pages/ReferPage";
import { generateWalletId } from "@/lib/walletId";

const ONBOARDING_KEY = "mfs_onboarding_done";

type SubPage = "limits" | "insights" | "refer" | null;

const USER_EMAIL = "tanvir@example.com";

const SESSION_KEY    = "mfs_authenticated";
const REGISTERED_KEY = "mfs_registered_phone";

const getRegisteredPhone = () => localStorage.getItem(REGISTERED_KEY) ?? "";

/* ─── KYC badge ─── */
const KycBadge = ({ verified }: { verified: boolean }) =>
  verified ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/12 text-primary border border-primary/20">
      <BadgeCheck size={11} /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
      <AlertCircle size={11} /> Unverified
    </span>
  );

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
  const [copied, setCopied]             = useState(false);
  const [biometric, setBiometric]       = useState(false);
  const [pushNotifs, setPushNotifs]     = useState(true);
  const [promoNotifs, setPromoNotifs]   = useState(true);
  const [twoFa, setTwoFa]               = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [showKyc, setShowKyc]           = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [subPage, setSubPage]           = useState<SubPage>(null);
  // Live-update name/photo after profile edit
  const [displayName, setDisplayNameState]   = useState(getDisplayName);
  const [displayPhoto, setDisplayPhotoState] = useState(getDisplayPhoto);

  const registeredPhone = getRegisteredPhone();
  const walletId = useMemo(() => generateWalletId(registeredPhone || "WALLET_USER"), [registeredPhone]);
  if (subPage === "limits")   return <LimitsPage           onBack={() => setSubPage(null)} />;
  if (subPage === "insights") return <SpendingInsightsPage onBack={() => setSubPage(null)} />;
  if (subPage === "refer")    return <ReferPage            onBack={() => setSubPage(null)} />;

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
    toast.success("Wallet ID copied!");
  };

  const handleProfileSaved = () => {
    setDisplayNameState(getDisplayName());
    setDisplayPhotoState(getDisplayPhoto());
  };

  const coming = (label: string) => toast.info(`${label} coming soon!`);

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
          {/* Decoration */}
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/6 pointer-events-none" />
          <div className="absolute -bottom-10 left-4 w-32 h-32 rounded-full bg-white/4 pointer-events-none" />

          <div className="relative flex items-center gap-4">
            {/* Avatar — tappable to edit profile */}
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
              {/* Edit overlay */}
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
                <Pencil size={16} className="text-white" />
              </div>
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[17px] font-bold">{displayName}</p>
                <KycBadge verified />
              </div>
              <p className="text-[13px] opacity-80 mt-0.5 font-medium">{registeredPhone ? `+880 ${registeredPhone}` : "—"}</p>
              <p className="text-[11px] opacity-55 truncate">{USER_EMAIL}</p>
            </div>
          </div>

          {/* Wallet ID */}
          <div className="relative mt-5 pt-4 border-t border-white/15 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] opacity-50 mb-0.5">Wallet ID</p>
              <p className="text-[13px] font-mono font-bold tracking-widest opacity-90">{walletId}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleCopy}
              className="glass-hero w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/25 transition-colors tap-target"
              title="Copy Wallet ID"
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
        <Section title="Account">
          <MenuRow icon={Pencil}    iconClass="gradient-hero"    label="Edit Profile"      sub="Update your name and profile photo"      onClick={() => setShowProfileEdit(true)} />
          <MenuRow icon={BadgeCheck} iconClass="gradient-primary" label="KYC Verification" sub="Full verification unlocks higher limits" onClick={() => setShowKyc(true)} />
          <MenuRow icon={Lock}       iconClass="gradient-send"    label="Change PIN"        sub="Update your 4-digit transaction PIN"    onClick={() => setShowChangePin(true)} />
          <MenuRow icon={Gift}       iconClass="gradient-accent"  label="Refer a Friend"   sub="Earn ৳50 for every successful referral" onClick={() => setSubPage("refer")} />
        </Section>

        {/* ── App Experience ── */}
        <Section title="App Experience">
          <MenuRow
            icon={PlayCircle}
            iconClass="gradient-hero"
            label="View Onboarding Again"
            sub="Replay the feature tour from the start"
            onClick={() => {
              localStorage.removeItem(ONBOARDING_KEY);
              toast.success("Onboarding reset! Restarting tour…");
              setTimeout(() => onReplayOnboarding?.(), 600);
            }}
          />
        </Section>

        {/* ── Insights & Limits ── */}
        <Section title="Insights & Limits">
          <MenuRow icon={BarChart3}  iconClass="gradient-payment"  label="Spending Insights" sub="Monthly breakdown & analytics"        onClick={() => setSubPage("insights")} />
          <MenuRow icon={CreditCard} iconClass="gradient-cashout"  label="Limits & Charges"  sub="Transaction limits, fees & tariffs"   onClick={() => setSubPage("limits")} />
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <ToggleRow icon={Bell}   iconClass="gradient-accent"  label="Push Notifications" sub="Transaction alerts & updates" checked={pushNotifs}  onCheckedChange={setPushNotifs} />
          <ToggleRow icon={BellOff} iconClass="gradient-payment" label="Promotional Alerts" sub="Offers, cashbacks & news"     checked={promoNotifs} onCheckedChange={setPromoNotifs} />
        </Section>

        {/* ── Security ── */}
        <Section title="Security & Privacy">
          <ToggleRow icon={Fingerprint} iconClass="gradient-send"    label="Biometric Login"  sub="Use fingerprint or face ID"   checked={biometric}   onCheckedChange={(v) => { setBiometric(v); toast.success(v ? "Biometric login enabled" : "Biometric login disabled"); }} />
          <ToggleRow icon={Shield}      iconClass="gradient-primary"  label="Two-Factor Auth"  sub="Extra OTP step on each login" checked={twoFa}       onCheckedChange={(v) => { setTwoFa(v); toast.success(v ? "2FA enabled" : "2FA disabled"); }} />
        </Section>

        {/* ── Sign Out ── */}
        <Section title="Account Actions">
          <MenuRow
            icon={LogOut}
            iconClass="bg-destructive"
            label="Sign Out"
            sub={registeredPhone ? `Signed in as +880 ${registeredPhone}` : "Sign out of your account"}
            danger
            right={<span />}
            onClick={() => {
              sessionStorage.removeItem(SESSION_KEY);
              onSignOut?.();
            }}
          />
        </Section>

        <p className="text-center text-[11px] text-muted-foreground pt-1 pb-2">
          BkashClone v1.0.0 · Built with ❤️
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
    </>
  );
};

export default AccountPage;

