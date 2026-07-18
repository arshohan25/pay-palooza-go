import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Check, ArrowLeft, Smartphone, Shield, BarChart3, Users, ShoppingBag, Copy, Share2, FileText, ClipboardCheck, Clock, RefreshCw, AlertCircle, TestTube2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getInstallPrompt, getInstallPromptForManifest, onPromptAvailable, clearPrompt } from "@/lib/installPromptStore";
import { useI18n } from "@/lib/i18n";
import { getLoginPathForRole, type AppRoleKey, type InstallableRoleKey } from "@/lib/appRole";

interface PrerequisiteGroup {
  title: string;
  icon: typeof Shield;
  items: string[];
}

const INSTALLED_ROLES_KEY = "mfs_pwa_installed_roles";
const INSTALL_HISTORY_KEY = "mfs_pwa_install_history";
const HISTORY_LIMIT_PER_ROLE = 20;

export type InstallHistoryAction =
  | "prompted"
  | "accepted"
  | "dismissed"
  | "failed"
  | "retry"
  | "manual-fallback"
  | "installed-event"
  | "reset";

export interface InstallHistoryEntry {
  action: InstallHistoryAction;
  at: number;
  note?: string;
}

type InstallHistoryMap = Record<string, InstallHistoryEntry[]>;

const readInstallHistory = (): InstallHistoryMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(INSTALL_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as InstallHistoryMap) : {};
  } catch {
    return {};
  }
};

const appendInstallHistory = (roleKey: string, action: InstallHistoryAction, note?: string) => {
  try {
    const map = readInstallHistory();
    const list = Array.isArray(map[roleKey]) ? map[roleKey] : [];
    const next = [{ action, at: Date.now(), note }, ...list].slice(0, HISTORY_LIMIT_PER_ROLE);
    map[roleKey] = next;
    localStorage.setItem(INSTALL_HISTORY_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("mfs:install-history", { detail: { roleKey } }));
  } catch {
    // ignore storage failures
  }
};

const clearInstallHistory = (roleKey: string) => {
  try {
    const map = readInstallHistory();
    delete map[roleKey];
    localStorage.setItem(INSTALL_HISTORY_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("mfs:install-history", { detail: { roleKey } }));
  } catch {
    // ignore
  }
};

const readInstalledRoles = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(INSTALLED_ROLES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((r): r is string => typeof r === "string") : [];
  } catch {
    return [];
  }
};

const rememberInstalledRole = (roleKey: string) => {
  try {
    const roles = new Set(readInstalledRoles());
    roles.add(roleKey);
    localStorage.setItem(INSTALLED_ROLES_KEY, JSON.stringify([...roles]));
  } catch {
    // ignore storage failures
  }
};

const isStandaloneDisplayMode = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
};

const openInstallLinkInBrowser = (url: string) => {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = url;
};

// Landing route for each role's installed PWA. Used by the "Open app" action
// so an already-installed role can be launched directly instead of trying to
// re-install (which would silently reload the current app shell).
const ROLE_APP_PATH: Record<InstallableRoleKey, string> = {
  customer: "/",
  agent: "/agent",
  merchant: "/merchant",
  distributor: "/distributor",
  "super-distributor": "/super-distributor",
  admin: "/admin",
};

const launchInstalledRoleApp = (roleKey: InstallableRoleKey) => {
  const path = ROLE_APP_PATH[roleKey] ?? "/";
  // Same-origin nav so the browser routes into the installed PWA's scope when
  // it exists, or opens the web version otherwise. Never reloads the current
  // app shell in place.
  window.location.assign(path);
};

const ACTION_LABEL: Record<InstallHistoryAction, string> = {
  prompted: "Install prompt shown",
  accepted: "Install accepted",
  dismissed: "Install dismissed",
  failed: "Install failed",
  retry: "Retry requested",
  "manual-fallback": "Manual install fallback",
  "installed-event": "App installed",
  reset: "Install state reset",
};

const ACTION_TONE: Record<InstallHistoryAction, string> = {
  prompted: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  accepted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  dismissed: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  failed: "bg-destructive/15 text-destructive",
  retry: "bg-primary/15 text-primary",
  "manual-fallback": "bg-muted text-muted-foreground",
  "installed-event": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  reset: "bg-muted text-muted-foreground",
};

const formatRelativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
};

const ROLE_CONFIG: Record<InstallableRoleKey, {
  name: string;
  shortName: string;
  description: string;
  manifest: string;
  icon: string;
  color: string;
  LucideIcon: typeof Shield;
  features: string[];
  prerequisites: PrerequisiteGroup[];
  approvalNote: string;
  approvalEta: string;
}> = {
  customer: {
    name: "EasyPay Customer",
    shortName: "EP Customer",
    description: "Send money, pay bills, cash out, shop, and manage your wallet.",
    manifest: "/manifest.json",
    icon: "/icons/icon-512.png",
    color: "from-emerald-500 to-teal-500",
    LucideIcon: Smartphone,
    features: ["Send Money", "Cash Out", "Mobile Recharge", "Shop Payments"],
    prerequisites: [
      {
        title: "Required details",
        icon: FileText,
        items: ["Active mobile number", "Wallet PIN", "KYC details for full limits"],
      },
      {
        title: "Setup steps",
        icon: ClipboardCheck,
        items: ["Install the customer app", "Sign in or create your wallet", "Complete KYC when prompted"],
      },
    ],
    approvalNote: "Customer app can be installed anytime. Some wallet features require KYC approval.",
    approvalEta: "Instant install",
  },
  admin: {
    name: "EasyPay Admin",
    shortName: "EP Admin",
    description: "Manage users, transactions, fraud alerts and platform settings.",
    manifest: "/manifest-admin.json",
    icon: "/icons/role-admin.png",
    color: "from-emerald-600 to-teal-500",
    LucideIcon: Shield,
    features: ["User & KYC Management", "Fraud Alert Monitor", "Fee & Commission Config", "Platform Treasury"],
    prerequisites: [
      {
        title: "Required details",
        icon: FileText,
        items: ["Corporate email invite from EasyPay HQ", "Employee ID and department", "Government photo ID for identity verification"],
      },
      {
        title: "Approval steps",
        icon: ClipboardCheck,
        items: ["Provisioned by Platform Owner only", "Mandatory 2FA enrolment on first login", "Device-bound OTP verification per portal"],
      },
    ],
    approvalNote: "Admin accounts are created internally — self-registration is not available.",
    approvalEta: "Instant after HQ provisioning",
  },
  "super-distributor": {
    name: "EasyPay Super Distributor",
    shortName: "EP SuperDist",
    description: "Manage distributors, float allocation, and commission networks.",
    manifest: "/manifest-super-distributor.json",
    icon: "/icons/role-super-distributor.png",
    color: "from-violet-600 to-purple-500",
    LucideIcon: BarChart3,
    features: ["Create Distributors", "Float Management", "Commission Tracking", "Territory Control"],
    prerequisites: [
      {
        title: "Required details",
        icon: FileText,
        items: ["Owner full name and active mobile number", "NID number (front & back scan)", "Trade licence copy", "Primary territory: Division › District › Upazila"],
      },
      {
        title: "Approval steps",
        icon: ClipboardCheck,
        items: ["Application reviewed by Platform Admin", "Territory conflict check with existing SDs", "Initial float deposit before first distributor is created"],
      },
    ],
    approvalNote: "Super Distributors are onboarded by Admin — no self sign-up. Provide all documents before requesting an account.",
    approvalEta: "1–3 business days",
  },
  distributor: {
    name: "EasyPay Distributor",
    shortName: "EP Distributor",
    description: "Create agents, manage float, and track commissions.",
    manifest: "/manifest-distributor.json",
    icon: "/icons/role-distributor.png",
    color: "from-blue-600 to-cyan-500",
    LucideIcon: Users,
    features: ["Create Agents", "Float Distribution", "Commission Reports", "Agent Monitoring"],
    prerequisites: [
      {
        title: "Required details",
        icon: FileText,
        items: ["Full name and active mobile number", "Parent Super Distributor reference", "NID number for KYC"],
      },
      {
        title: "Approval steps",
        icon: ClipboardCheck,
        items: ["Created and linked by your Super Distributor", "Float credited from SD wallet after activation"],
      },
    ],
    approvalNote: "Distributors are created by a Super Distributor. Contact your regional SD to be linked.",
    approvalEta: "Same day, after SD linking",
  },
  agent: {
    name: "EasyPay Agent",
    shortName: "EP Agent",
    description: "Cash-in, cash-out, bill pay, and customer onboarding.",
    manifest: "/manifest-agent.json",
    icon: "/icons/role-agent.png",
    color: "from-orange-500 to-amber-500",
    LucideIcon: Smartphone,
    features: ["Cash In / Cash Out", "Bill Payment", "Customer Registration", "Transaction History"],
    prerequisites: [
      {
        title: "Required details",
        icon: FileText,
        items: ["Full name and shop/outlet name", "Active mobile number for OTP", "NID number and photo", "Shop address (Division › District › Upazila)"],
      },
      {
        title: "Approval steps",
        icon: ClipboardCheck,
        items: ["Register from the Agent login screen or via your Distributor", "KYC review and shop verification", "Opening float top-up before going live"],
      },
    ],
    approvalNote: "You can self-register as an Agent, or ask your Distributor to create your account.",
    approvalEta: "Usually within 24 hours",
  },
  merchant: {
    name: "EasyPay Merchant",
    shortName: "EP Merchant",
    description: "Accept payments, manage products, and track analytics.",
    manifest: "/manifest-merchant.json",
    icon: "/icons/role-merchant.png",
    color: "from-rose-500 to-pink-500",
    LucideIcon: ShoppingBag,
    features: ["Accept QR Payments", "Product Management", "Revenue Analytics", "Settlement Tracking"],
    prerequisites: [
      {
        title: "Required details",
        icon: FileText,
        items: ["Business name and category", "Owner NID and mobile number", "Trade licence or business proof", "Bank account for settlements"],
      },
      {
        title: "Approval steps",
        icon: ClipboardCheck,
        items: ["Submit merchant application in-app", "Compliance & KYC review", "QR kit issued after approval"],
      },
    ],
    approvalNote: "Merchant accounts require a valid business and settlement bank account.",
    approvalEta: "1–2 business days",
  },
};

const RoleInstallPage = () => {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [hasPrompt, setHasPrompt] = useState(!!getInstallPrompt());
  const [installedRole, setInstalledRole] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [attemptState, setAttemptState] = useState<"idle" | "dismissed" | "failed">("idle");
  const [attemptCount, setAttemptCount] = useState(0);
  const checklistKey = role ? `mfs_install_checklist_${role}` : null;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Load saved checklist progress
  useEffect(() => {
    if (!checklistKey) return;
    try {
      const raw = localStorage.getItem(checklistKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [checklistKey]);

  const toggleItem = (key: string) => {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (checklistKey) {
        try {
          localStorage.setItem(checklistKey, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const roleKey = role && role in ROLE_CONFIG ? (role as InstallableRoleKey) : null;
  const config = roleKey ? ROLE_CONFIG[roleKey] : null;

  // Swap manifest link for this role. If a different role manifest was
  // already evaluated on this page load, force a full reload so Chrome
  // re-fires `beforeinstallprompt` for the correct role — otherwise only the
  // first-visited role can be installed per tab.
  useEffect(() => {
    if (!config) return;
    if (roleKey && window.location.pathname.startsWith(`/install/${roleKey}`)) {
      window.location.replace(`/${roleKey}/install${window.location.search}`);
      return;
    }
    const existing = document.querySelector('link[rel="manifest"]');
    const currentHref = existing?.getAttribute("href");
    const desired = config.manifest;
    if (currentHref && currentHref !== desired) {
      window.location.replace(window.location.pathname + window.location.search);
      return;
    }
    if (existing) existing.setAttribute("href", desired);
  }, [config]);

  useEffect(() => {
    if (!config) return;
    const rolePromptAvailable = () => Boolean(getInstallPromptForManifest(config.manifest));
    const recheck = () => setHasPrompt(rolePromptAvailable());

    recheck();
    setIsStandalone(isStandaloneDisplayMode());
    setInstalledRole(roleKey && readInstalledRoles().includes(roleKey) ? roleKey : null);

    const unsub = onPromptAvailable(() => {
      const hasRolePrompt = rolePromptAvailable();
      setHasPrompt(hasRolePrompt);
      // A fresh prompt arrived — clear any prior attempt error state so the
      // primary install button reappears without a manual refresh.
      if (hasRolePrompt) setAttemptState("idle");
    });
    const onInstalled = () => {
      if (!roleKey) return;
      rememberInstalledRole(roleKey);
      appendInstallHistory(roleKey, "installed-event");
      setInstalledRole(roleKey);
      setAttemptState("idle");
    };
    // Chrome may re-fire beforeinstallprompt when the tab becomes visible
    // again after a dismissal. Re-check on focus/visibility so the retry
    // button flips back to the primary install button automatically.
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    const interval = window.setInterval(recheck, 2000);
    return () => {
      unsub();
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
      window.clearInterval(interval);
    };
  }, [roleKey, config]);

  const handleInstall = async () => {
    const prompt = config ? getInstallPromptForManifest(config.manifest) : null;
    if (!prompt) {
      if (getInstallPrompt()) {
        clearPrompt();
        setHasPrompt(false);
      }
      if (roleKey) appendInstallHistory(roleKey, "manual-fallback", isStandalone ? "standalone: opened in browser tab" : "no role-matched beforeinstallprompt available");
      if (isStandalone) {
        openInstallLinkInBrowser(window.location.href);
        toast.info("Opening this installer in your browser. Install prompts cannot run inside another installed role app.");
      } else if (attemptCount > 0) {
        toast.info("Retrying — reloading to re-request the install prompt…");
        window.setTimeout(() => window.location.reload(), 400);
      } else {
        toast.info("Use your browser menu to install this role app, or tap Retry to try again.");
      }
      return;
    }
    setAttemptCount((n) => n + 1);
    if (roleKey) appendInstallHistory(roleKey, "prompted");
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        if (roleKey) {
          rememberInstalledRole(roleKey);
          appendInstallHistory(roleKey, "accepted");
          setInstalledRole(roleKey);
        }
        clearPrompt();
        setHasPrompt(false);
        setAttemptState("idle");
      } else {
        if (roleKey) appendInstallHistory(roleKey, "dismissed");
        clearPrompt();
        setHasPrompt(false);
        setAttemptState("dismissed");
      }
    } catch (err) {
      if (roleKey) appendInstallHistory(roleKey, "failed", err instanceof Error ? err.message : undefined);
      clearPrompt();
      setHasPrompt(false);
      setAttemptState("failed");
    }
  };

  const handleRetry = () => {
    if (roleKey) appendInstallHistory(roleKey, "retry");
    if (isStandalone) {
      openInstallLinkInBrowser(window.location.href);
      toast.info("Opening this installer in your browser. Install prompts cannot run inside another installed role app.");
      return;
    }
    if (config && getInstallPromptForManifest(config.manifest)) {
      setHasPrompt(true);
      setAttemptState("idle");
      void handleInstall();
      return;
    }
    if (getInstallPrompt()) {
      clearPrompt();
      setHasPrompt(false);
    }
    toast.info("Reloading to re-request the install prompt…");
    window.setTimeout(() => window.location.reload(), 300);
  };


  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <h1 className="text-xl font-bold text-foreground mb-4">{t("ripChooseApp")}</h1>
        <div className="grid gap-3 w-full max-w-sm">
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/${key}/install`)}
              className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-accent/50 transition-colors text-left"
            >
              <img src={cfg.icon} alt={cfg.shortName} className="w-12 h-12 rounded-xl" />
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground">{cfg.name}</p>
                <p className="text-xs text-muted-foreground truncate">{cfg.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  const Icon = config.LucideIcon;
  const currentRoleInstalled = installedRole === roleKey;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className={`bg-gradient-to-br ${config.color} text-white px-6 pt-12 pb-10 relative overflow-hidden`}>
        <button onClick={() => navigate("/install")} className="absolute top-4 left-4 p-2 rounded-xl bg-white/20 backdrop-blur-sm">
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-col items-center text-center mt-4">
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={config.icon}
            alt={config.name}
            className="w-24 h-24 rounded-3xl shadow-2xl mb-4 border-2 border-white/30"
          />
          <h1 className="text-2xl font-extrabold">{config.name}</h1>
          <p className="text-sm opacity-90 mt-1 max-w-xs">{config.description}</p>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 -mt-4 bg-background rounded-t-3xl relative z-10">
        <div className="mb-8">
          <h2 className="text-sm font-bold text-foreground mb-3">{t("ripWhatsIncluded")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {config.features.map((f) => (
              <div key={f} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                <Check size={14} className="text-primary shrink-0" />
                <span className="text-xs text-foreground font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          {(() => {
            const allItems = config.prerequisites.flatMap((g) => g.items);
            const doneCount = allItems.filter((i) => checked[i]).length;
            const pct = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-foreground">Before you install</h2>
                  <span className="text-[11px] font-semibold text-muted-foreground">{doneCount}/{allItems.length} ready</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
                  <div
                    className={`h-full bg-gradient-to-r ${config.color} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            );
          })()}
          <div className="space-y-3">
            {config.prerequisites.map((group) => {
              const GIcon = group.icon;
              return (
                <div key={group.title} className="p-4 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-white`}>
                      <GIcon size={14} />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{group.title}</p>
                  </div>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const isDone = !!checked[item];
                      return (
                        <li key={item}>
                          <button
                            type="button"
                            onClick={() => toggleItem(item)}
                            className="w-full flex items-start gap-2 text-left p-2 -mx-2 rounded-lg hover:bg-background/60 transition-colors"
                            aria-pressed={isDone}
                          >
                            <span
                              className={`mt-0.5 w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isDone ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"
                              }`}
                            >
                              {isDone && <Check size={10} className="text-primary-foreground" strokeWidth={3} />}
                            </span>
                            <span className={`text-xs transition-colors ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                              {item}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            <div className="p-3 rounded-2xl border border-dashed border-border bg-background/50">
              <div className="flex items-start gap-2">
                <Clock size={14} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">Approval time: {config.approvalEta}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{config.approvalNote}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ShareLinksSection roleKey={roleKey!} shortName={config.shortName} />

        <InstallabilityTestSection
          roleKey={roleKey!}
          manifestHref={config.manifest}
          hasPrompt={hasPrompt}
          isStandalone={isStandalone}
          color={config.color}
        />


        <PerRoleInstallStatePanel
          currentRole={roleKey!}
          hasPrompt={hasPrompt}
          isStandalone={isStandalone}
          currentRoleInstalled={currentRoleInstalled}
        />

        <AnimatePresence mode="wait">

          {currentRoleInstalled ? (
            <motion.div key="installed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Check size={28} className="text-primary" />
              </div>
              <p className="font-bold text-foreground">{t("ripAppInstalled")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("ripCheckHome")}</p>
            </motion.div>
          ) : attemptState !== "idle" && !hasPrompt ? (
            <motion.div key="retry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {attemptState === "dismissed" ? "Install cancelled" : "Install did not complete"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You can retry right away — no need to refresh manually.
                    {attemptCount > 1 ? " If the prompt still won't appear, we'll reload the page for you." : ""}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleRetry}
                className={`w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r ${config.color} text-white shadow-lg`}
              >
                <RefreshCw size={18} className="mr-2" />
                Retry install {config.shortName}
              </Button>
              <button
                type="button"
                onClick={() => setAttemptState("idle")}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Dismiss and use manual install steps
              </button>
            </motion.div>
          ) : hasPrompt ? (
            <motion.div key="installable" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button
                onClick={handleInstall}
                className={`w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r ${config.color} text-white shadow-lg`}
              >
                <Download size={18} className="mr-2" />
                {t("ripInstall")} {config.shortName}
              </Button>
            </motion.div>
          ) : (
            <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3">
              <Button
                onClick={handleInstall}
                className={`w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r ${config.color} text-white shadow-lg`}
              >
                <Download size={18} className="mr-2" />
                {t("ripInstall")} {config.shortName}
              </Button>
              <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                <Icon size={24} className="text-primary mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">
                  {isStandalone ? "Open this link in your browser to add another role app" : t("ripInstallManually")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>{t("ripIphone")}</strong> {t("ripIphoneHint")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <strong>{t("ripAndroid")}</strong> {t("ripAndroidHint")}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default RoleInstallPage;

interface InstallabilityTestSectionProps {
  roleKey: string;
  manifestHref: string;
  hasPrompt: boolean;
  isStandalone: boolean;
  color: string;
}

type CheckStatus = "pass" | "fail" | "warn";
interface CheckResult {
  label: string;
  status: CheckStatus;
  detail: string;
}

const InstallabilityTestSection = ({
  roleKey,
  manifestHref,
  hasPrompt,
  isStandalone,
  color,
}: InstallabilityTestSectionProps) => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [ranAt, setRanAt] = useState<number | null>(null);

  const overall: CheckStatus | null = results
    ? results.some((r) => r.status === "fail")
      ? "fail"
      : results.some((r) => r.status === "warn")
        ? "warn"
        : "pass"
    : null;

  const runTest = async () => {
    setRunning(true);
    const checks: CheckResult[] = [];
    const currentPath = window.location.pathname;
    const expectedScope = `/${roleKey}/`;

    // 1. Manifest <link> in DOM
    const linkEl = document.querySelector('link[rel="manifest"]');
    const linkHref = linkEl?.getAttribute("href") ?? null;
    checks.push(
      linkHref === manifestHref
        ? { label: "Manifest <link> in head", status: "pass", detail: `href="${linkHref}"` }
        : {
            label: "Manifest <link> in head",
            status: "fail",
            detail: linkHref ? `Expected ${manifestHref}, found ${linkHref}` : "No manifest link tag found",
          },
    );

    // 2. Manifest fetch + parse
    let manifest: Record<string, unknown> | null = null;
    try {
      const res = await fetch(manifestHref, { cache: "no-cache" });
      if (!res.ok) {
        checks.push({
          label: "Manifest file loads",
          status: "fail",
          detail: `HTTP ${res.status} fetching ${manifestHref}`,
        });
      } else {
        manifest = (await res.json()) as Record<string, unknown>;
        checks.push({
          label: "Manifest file loads",
          status: "pass",
          detail: `Fetched ${manifestHref} (${JSON.stringify(manifest).length} bytes)`,
        });
      }
    } catch (err) {
      checks.push({
        label: "Manifest file loads",
        status: "fail",
        detail: err instanceof Error ? err.message : "Failed to fetch manifest",
      });
    }

    if (manifest) {
      // 3. Scope matches current route
      const scope = String(manifest.scope ?? "");
      const scopeOk = scope === expectedScope;
      const routeInScope = currentPath.startsWith(expectedScope) || currentPath === expectedScope.replace(/\/$/, "");
      checks.push(
        scopeOk
          ? { label: "Manifest scope", status: "pass", detail: `scope="${scope}"` }
          : { label: "Manifest scope", status: "fail", detail: `Expected "${expectedScope}", found "${scope || "(missing)"}"` },
      );
      checks.push(
        routeInScope
          ? { label: "Current route inside scope", status: "pass", detail: `${currentPath} ⊂ ${expectedScope}` }
          : {
              label: "Current route inside scope",
              status: "fail",
              detail: `Route ${currentPath} is not under ${expectedScope}`,
            },
      );

      // 4. start_url under scope + carries ?app=<role>
      const startUrl = String(manifest.start_url ?? "");
      const startUrlOk = startUrl.startsWith(`/${roleKey}`) && startUrl.includes(`app=${roleKey}`);
      checks.push(
        startUrlOk
          ? { label: "start_url binds this role", status: "pass", detail: startUrl }
          : { label: "start_url binds this role", status: "fail", detail: `start_url="${startUrl}"` },
      );

      // 5. display: standalone
      const display = String(manifest.display ?? "");
      checks.push(
        display === "standalone"
          ? { label: "display: standalone", status: "pass", detail: display }
          : { label: "display: standalone", status: "warn", detail: `display="${display || "(missing)"}"` },
      );

      // 6. icons present
      const icons = Array.isArray(manifest.icons) ? (manifest.icons as unknown[]) : [];
      checks.push(
        icons.length > 0
          ? { label: "Icons declared", status: "pass", detail: `${icons.length} icon(s)` }
          : { label: "Icons declared", status: "fail", detail: "No icons in manifest" },
      );

      // 7. id present
      const id = String(manifest.id ?? "");
      checks.push(
        id
          ? { label: "Unique id", status: "pass", detail: `id="${id}"` }
          : { label: "Unique id", status: "warn", detail: "No id — browser may share identity across roles" },
      );
    }

    // 8. Service worker
    const swReg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    checks.push(
      swReg
        ? { label: "Service worker registered", status: "pass", detail: `scope=${swReg.scope}` }
        : { label: "Service worker registered", status: "warn", detail: "No SW — required for installability on most browsers" },
    );

    // 9. beforeinstallprompt / already installed
    if (isStandalone) {
      checks.push({
        label: "Install prompt",
        status: "warn",
        detail: "Running in standalone (app already installed). Open in a browser tab to reinstall.",
      });
    } else if (hasPrompt) {
      checks.push({ label: "Install prompt", status: "pass", detail: "beforeinstallprompt captured — ready to install" });
    } else {
      checks.push({
        label: "Install prompt",
        status: "warn",
        detail: "No beforeinstallprompt yet — browser may not have qualified this app, or it's already installed",
      });
    }

    setResults(checks);
    setRanAt(Date.now());
    setRunning(false);

    const failed = checks.filter((c) => c.status === "fail").length;
    const warned = checks.filter((c) => c.status === "warn").length;
    if (failed > 0) {
      toast.error(`${failed} installability check${failed > 1 ? "s" : ""} failed`);
    } else if (warned > 0) {
      toast.warning(`Installability OK, ${warned} warning${warned > 1 ? "s" : ""}`);
    } else {
      toast.success("All installability checks passed");
    }
  };

  const StatusIcon = ({ status }: { status: CheckStatus }) =>
    status === "pass" ? (
      <Check size={12} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
    ) : status === "fail" ? (
      <X size={12} className="text-destructive" strokeWidth={3} />
    ) : (
      <AlertCircle size={12} className="text-amber-600 dark:text-amber-400" />
    );

  const statusBg = (s: CheckStatus) =>
    s === "pass"
      ? "bg-emerald-500/15"
      : s === "fail"
        ? "bg-destructive/15"
        : "bg-amber-500/15";

  return (
    <div className="mb-6" data-testid="installability-test">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground">Installability test</h2>
        {overall && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              overall === "pass"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : overall === "fail"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            }`}
          >
            {overall === "pass" ? "READY" : overall === "fail" ? "BLOCKED" : "WARNINGS"}
          </span>
        )}
      </div>
      <Button
        type="button"
        onClick={runTest}
        disabled={running}
        variant="outline"
        className="w-full h-11 rounded-2xl font-semibold"
      >
        {running ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            Running checks…
          </>
        ) : (
          <>
            <TestTube2 size={16} className="mr-2" />
            {results ? "Re-run installability test" : "Test installability"}
          </>
        )}
      </Button>
      {results && (
        <div className="mt-3 p-3 rounded-2xl border border-border bg-muted/40 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Ran {ranAt ? formatRelativeTime(ranAt) : "just now"} · manifest <span className="font-mono">{manifestHref}</span> · scope <span className="font-mono">/{roleKey}/</span>
          </p>
          <ul className="space-y-1.5">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`w-5 h-5 rounded-full ${statusBg(r.status)} flex items-center justify-center shrink-0 mt-0.5`}>
                  <StatusIcon status={r.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{r.label}</p>
                  <p className="text-[11px] text-muted-foreground break-words">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          {overall === "fail" && (
            <p className="text-[11px] text-destructive font-medium pt-1">
              Fix the failing checks above before the install prompt can appear reliably.
            </p>
          )}
          {overall === "pass" && !hasPrompt && !isStandalone && (
            <p className="text-[11px] text-muted-foreground pt-1">
              Manifest and scope look correct. If no prompt appears, the browser may still be evaluating engagement heuristics — interact with the page and re-test.
            </p>
          )}
        </div>
      )}
    </div>
  );
};



interface ShareLinksSectionProps {
  roleKey: string;
  shortName: string;
}

const ShareLinksSection = ({ roleKey, shortName }: ShareLinksSectionProps) => {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://pay-palooza-go.lovable.app";
  const installUrl = `${origin}/${roleKey}/install`;
  const loginUrl =
    roleKey === "customer"
      ? `${origin}/customer/?app=customer`
      : `${origin}${getLoginPathForRole(roleKey as AppRoleKey)}?app=${roleKey}`;

  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} link copied`);
    } catch {
      toast.error("Could not copy — long-press the link to copy manually");
    }
  };

  const share = async (url: string, title: string) => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or share failed — fall back to copy
      }
    }
    await copy(url, title);
  };

  const rows: { key: string; label: string; url: string }[] = [
    { key: "install", label: `${shortName} install page`, url: installUrl },
    { key: "login", label: roleKey === "customer" ? `${shortName} app` : `${shortName} login`, url: loginUrl },
  ];

  return (
    <div className="mb-6" data-testid="share-links">
      <h2 className="text-sm font-bold text-foreground mb-3">Share this app</h2>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-2 p-3 rounded-2xl bg-muted/50 border border-border"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">{row.label}</p>
              <p className="text-[11px] text-muted-foreground truncate font-mono">{row.url}</p>
            </div>
            <button
              type="button"
              aria-label={`Copy ${row.label} link`}
              onClick={() => copy(row.url, row.label)}
              className="p-2 rounded-lg bg-background hover:bg-accent transition-colors"
            >
              <Copy size={14} className="text-foreground" />
            </button>
            <button
              type="button"
              aria-label={`Share ${row.label} link`}
              onClick={() => share(row.url, row.label)}
              className="p-2 rounded-lg bg-background hover:bg-accent transition-colors"
            >
              <Share2 size={14} className="text-foreground" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PerRoleInstallStatePanelProps {
  currentRole: string;
  hasPrompt: boolean;
  isStandalone: boolean;
  currentRoleInstalled: boolean;
}

const PerRoleInstallStatePanel = ({
  currentRole,
  hasPrompt,
  isStandalone,
  currentRoleInstalled,
}: PerRoleInstallStatePanelProps) => {
  const [installedRoles, setInstalledRolesState] = useState<string[]>(() => readInstalledRoles());
  const [history, setHistory] = useState<InstallHistoryMap>(() => readInstallHistory());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [currentRole]: true });
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://pay-palooza-go.lovable.app";

  useEffect(() => {
    const refresh = () => {
      setInstalledRolesState(readInstalledRoles());
      setHistory(readInstallHistory());
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === INSTALL_HISTORY_KEY || e.key === INSTALLED_ROLES_KEY) refresh();
    };
    window.addEventListener("mfs:install-history", refresh as EventListener);
    window.addEventListener("storage", onStorage);
    const interval = window.setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("mfs:install-history", refresh as EventListener);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, []);

  const clearRole = (roleKey: InstallableRoleKey) => {
    try {
      const next = installedRoles.filter((r) => r !== roleKey);
      localStorage.setItem(INSTALLED_ROLES_KEY, JSON.stringify(next));
      appendInstallHistory(roleKey, "reset");
      toast.success(`Cleared install state for ${ROLE_CONFIG[roleKey]?.shortName ?? roleKey}`);
      window.setTimeout(() => window.location.reload(), 400);
    } catch {
      toast.error("Could not clear install state");
    }
  };

  const clearHistoryFor = (roleKey: InstallableRoleKey) => {
    clearInstallHistory(roleKey);
    setHistory((prev) => {
      const next = { ...prev };
      delete next[roleKey];
      return next;
    });
    toast.success(`Cleared history for ${ROLE_CONFIG[roleKey]?.shortName ?? roleKey}`);
  };

  return (
    <div className="mb-6" data-testid="install-state-panel">
      <h2 className="text-sm font-bold text-foreground mb-3">Per-role install state</h2>
      <div className="space-y-2">
        {(Object.entries(ROLE_CONFIG) as Array<[InstallableRoleKey, (typeof ROLE_CONFIG)[InstallableRoleKey]]>).map(([key, cfg]) => {
          const isCurrent = key === currentRole;
          const isInstalled = installedRoles.includes(key);
          const entries = history[key] ?? [];
          const lastEntry = entries[0];
          const isOpen = !!expanded[key];
          let reason = "";
          let buttonState: "shown" | "hidden" = "hidden";

          if (isCurrent) {
            if (currentRoleInstalled) {
              reason = "Already installed on this device — button hidden, success screen shown.";
              buttonState = "hidden";
            } else if (hasPrompt) {
              reason = "beforeinstallprompt captured for this role — install button is shown.";
              buttonState = "shown";
            } else if (isStandalone) {
              reason = "Running in standalone mode (another role app). Fallback button opens browser install page.";
              buttonState = "shown";
            } else {
              reason = "No install prompt yet — showing manual install fallback with browser hints.";
              buttonState = "shown";
            }
          } else if (isInstalled) {
            reason = "Marked installed previously. Open its install page to reinstall or manage.";
          } else {
            reason = "Not installed. Open its install page to add this role app.";
          }

          return (
            <div
              key={key}
              className={`p-3 rounded-2xl border ${
                isCurrent ? "border-primary/50 bg-primary/5" : "border-border bg-muted/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <img src={cfg.icon} alt={cfg.shortName} className="w-9 h-9 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-foreground">{cfg.shortName}</p>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                        CURRENT
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isInstalled
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isInstalled ? "INSTALLED" : "NOT INSTALLED"}
                    </span>
                    {isCurrent && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          buttonState === "shown"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        BUTTON {buttonState.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{reason}</p>
                  {lastEntry ? (
                    <p className="text-[11px] text-foreground mt-1">
                      <span
                        className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mr-1 align-middle ${ACTION_TONE[lastEntry.action]}`}
                      >
                        {ACTION_LABEL[lastEntry.action]}
                      </span>
                      <span className="text-muted-foreground">
                        {formatRelativeTime(lastEntry.at)} · {new Date(lastEntry.at).toLocaleString()}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/70 mt-1 italic">No install attempts recorded yet.</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 font-mono truncate mt-1">
                    {origin}/{key}/install
                  </p>
                  {entries.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className="text-[10px] font-semibold text-primary hover:underline"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Hide" : "Show"} history ({entries.length})
                      </button>
                      {isOpen && (
                        <ol className="mt-2 space-y-1 border-l border-border pl-3">
                          {entries.map((entry, idx) => (
                            <li key={`${entry.at}-${idx}`} className="text-[11px] flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ACTION_TONE[entry.action]}`}
                                >
                                  {ACTION_LABEL[entry.action]}
                                </span>
                                <span className="text-muted-foreground">{formatRelativeTime(entry.at)}</span>
                                <span className="text-muted-foreground/70">·</span>
                                <span className="text-muted-foreground/70 tabular-nums">
                                  {new Date(entry.at).toLocaleString()}
                                </span>
                              </div>
                              {entry.note && (
                                <p className="text-[10px] text-muted-foreground/80 pl-1">{entry.note}</p>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {!isCurrent && (
                    <a
                      href={`/${key}/install`}
                      className="text-[10px] px-2 py-1 rounded-md bg-background border border-border hover:bg-accent text-foreground text-center"
                    >
                      Open
                    </a>
                  )}
                  {isInstalled && (
                    <button
                      type="button"
                      onClick={() => clearRole(key)}
                      className="text-[10px] px-2 py-1 rounded-md bg-background border border-border hover:bg-destructive/10 text-destructive"
                    >
                      Reset
                    </button>
                  )}
                  {entries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearHistoryFor(key)}
                      className="text-[10px] px-2 py-1 rounded-md bg-background border border-border hover:bg-accent text-muted-foreground"
                    >
                      Clear log
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground/70 mt-2">
        Install state and attempt history are tracked locally per browser (last {HISTORY_LIMIT_PER_ROLE} events per role).
      </p>
    </div>
  );
};



