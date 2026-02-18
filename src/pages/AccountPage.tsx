import { useState } from "react";
import { motion } from "framer-motion";
import {
  Copy, CheckCheck, ChevronRight,
  Shield, Bell, Fingerprint, BarChart3, CreditCard,
  Gift, Lock, LogOut, BadgeCheck, AlertCircle,
  BellOff, Eye, Zap
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ChangePinFlow from "@/components/ChangePinFlow";

const WALLET_ID = "MFS-A3F1-9C22";
const USER_NAME = "Tanvir Hasan";
const USER_PHONE = "01712-345678";
const USER_EMAIL = "tanvir@example.com";

/* ─── KYC status badge ─── */
const KycBadge = ({ verified }: { verified: boolean }) =>
  verified ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
      <BadgeCheck size={12} /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
      <AlertCircle size={12} /> Unverified
    </span>
  );

/* ─── Section wrapper ─── */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">
      {title}
    </p>
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
      {children}
    </div>
  </div>
);

/* ─── Row: tappable ─── */
const MenuRow = ({
  icon: Icon,
  iconClass = "gradient-primary",
  label,
  sub,
  right,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  iconClass?: string;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors last:border-0 border-b border-border group"
  >
    <div
      className={`w-9 h-9 rounded-xl flex items-center justify-center text-primary-foreground shrink-0 ${iconClass}`}
    >
      <Icon size={17} strokeWidth={2} />
    </div>
    <div className="flex-1 text-left min-w-0">
      <p className={`text-sm font-medium ${danger ? "text-destructive" : "text-foreground"} truncate`}>
        {label}
      </p>
      {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
    {right ?? (
      <ChevronRight size={16} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
    )}
  </button>
);

/* ─── Row: toggle ─── */
const ToggleRow = ({
  icon: Icon,
  iconClass = "gradient-primary",
  label,
  sub,
  checked,
  onCheckedChange,
}: {
  icon: React.ElementType;
  iconClass?: string;
  label: string;
  sub?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) => (
  <div className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
    <div
      className={`w-9 h-9 rounded-xl flex items-center justify-center text-primary-foreground shrink-0 ${iconClass}`}
    >
      <Icon size={17} strokeWidth={2} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground truncate">{label}</p>
      {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

/* ─── Main ─── */
const AccountPage = () => {
  const [copied, setCopied] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [promoNotifs, setPromoNotifs] = useState(true);
  const [twoFa, setTwoFa] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(WALLET_ID);
    } catch {
      const el = document.createElement("textarea");
      el.value = WALLET_ID;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Wallet ID copied!");
  };

  const coming = (label: string) => toast.info(`${label} coming soon!`);

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-6"
    >
      {/* ── Profile card ── */}
      <div className="gradient-hero rounded-2xl p-5 text-primary-foreground shadow-glow">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold text-white shrink-0">
            T
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg font-bold">{USER_NAME}</p>
              <KycBadge verified />
            </div>
            <p className="text-sm opacity-80 mt-0.5">{USER_PHONE}</p>
            <p className="text-xs opacity-60 truncate">{USER_EMAIL}</p>
          </div>
        </div>

        {/* Wallet ID row */}
        <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
          <div>
            <p className="text-xs opacity-60">Wallet ID</p>
            <p className="text-sm font-mono font-semibold tracking-widest opacity-90">{WALLET_ID}</p>
          </div>
          <button
            onClick={handleCopy}
            className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
            title="Copy Wallet ID"
          >
            {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      {/* ── Account ── */}
      <Section title="Account">
        <MenuRow
          icon={BadgeCheck}
          iconClass="gradient-primary"
          label="KYC Verification"
          sub="Full verification unlocks higher limits"
          onClick={() => coming("KYC")}
        />
        <MenuRow
          icon={Lock}
          iconClass="gradient-send"
          label="Change PIN"
          sub="Update your 4-digit transaction PIN"
          onClick={() => setShowChangePin(true)}
        />
        <MenuRow
          icon={Gift}
          iconClass="gradient-accent"
          label="Refer a Friend"
          sub="Earn ৳50 for every successful referral"
          onClick={() => coming("Refer a Friend")}
        />
      </Section>

      {/* ── Insights & Limits ── */}
      <Section title="Insights & Limits">
        <MenuRow
          icon={BarChart3}
          iconClass="gradient-payment"
          label="Spending Insights"
          sub="Monthly breakdown & analytics"
          onClick={() => coming("Insights")}
        />
        <MenuRow
          icon={CreditCard}
          iconClass="gradient-cashout"
          label="Limits & Charges"
          sub="Transaction limits, fees & tariffs"
          onClick={() => coming("Limits")}
        />
      </Section>

      {/* ── Notifications ── */}
      <Section title="Notifications">
        <ToggleRow
          icon={Bell}
          iconClass="gradient-accent"
          label="Push Notifications"
          sub="Transaction alerts & updates"
          checked={pushNotifs}
          onCheckedChange={setPushNotifs}
        />
        <ToggleRow
          icon={BellOff}
          iconClass="gradient-payment"
          label="Promotional Alerts"
          sub="Offers, cashbacks & news"
          checked={promoNotifs}
          onCheckedChange={setPromoNotifs}
        />
      </Section>

      {/* ── Security ── */}
      <Section title="Security & Privacy">
        <ToggleRow
          icon={Fingerprint}
          iconClass="gradient-send"
          label="Biometric Login"
          sub="Use fingerprint or face ID to sign in"
          checked={biometric}
          onCheckedChange={(v) => {
            setBiometric(v);
            toast.success(v ? "Biometric login enabled" : "Biometric login disabled");
          }}
        />
        <ToggleRow
          icon={Shield}
          iconClass="gradient-primary"
          label="Two-Factor Auth"
          sub="Extra OTP step on each login"
          checked={twoFa}
          onCheckedChange={(v) => {
            setTwoFa(v);
            toast.success(v ? "2FA enabled" : "2FA disabled");
          }}
        />
        <ToggleRow
          icon={Eye}
          iconClass="gradient-cashout"
          label="Hide Balance by Default"
          sub="Balance masked until you tap show"
          checked={hideBalance}
          onCheckedChange={setHideBalance}
        />
        <MenuRow
          icon={Zap}
          iconClass="gradient-addmoney"
          label="Active Sessions"
          sub="Manage logged-in devices"
          onClick={() => coming("Sessions")}
        />
      </Section>

      {/* ── Logout ── */}
      <Section title="Account Actions">
        <MenuRow
          icon={LogOut}
          iconClass="bg-destructive"
          label="Log Out"
          danger
          onClick={() => toast.error("Logout requires authentication integration")}
          right={<span />}
        />
      </Section>

      {/* App version */}
      <p className="text-center text-xs text-muted-foreground pt-2">
        BkashClone v1.0.0 · Made with ❤️
      </p>
    </motion.div>

    {/* ── Change PIN overlay ── */}
    {showChangePin && <ChangePinFlow onClose={() => setShowChangePin(false)} />}
  </>
  );
};

export default AccountPage;
