import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Check, ArrowLeft, Smartphone, Shield, BarChart3, Users, ShoppingBag, Copy, Share2, FileText, ClipboardCheck, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getInstallPrompt, onPromptAvailable, clearPrompt } from "@/lib/installPromptStore";
import { useI18n } from "@/lib/i18n";
import { getLoginPathForRole, type AppRoleKey } from "@/lib/appRole";

interface PrerequisiteGroup {
  title: string;
  icon: typeof Shield;
  items: string[];
}

const INSTALLED_ROLES_KEY = "mfs_pwa_installed_roles";

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

const ROLE_CONFIG: Record<string, {
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

  const config = role ? ROLE_CONFIG[role] : null;

  // Swap manifest link for this role. If a different role manifest was
  // already evaluated on this page load, force a full reload so Chrome
  // re-fires `beforeinstallprompt` for the correct role — otherwise only the
  // first-visited role can be installed per tab.
  useEffect(() => {
    if (!config) return;
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
    setHasPrompt(!!getInstallPrompt());
    setIsStandalone(isStandaloneDisplayMode());
    setInstalledRole(role && readInstalledRoles().includes(role) ? role : null);

    const unsub = onPromptAvailable(() => setHasPrompt(true));
    const onInstalled = () => {
      if (!role) return;
      rememberInstalledRole(role);
      setInstalledRole(role);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      unsub();
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [role]);

  const handleInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) {
      if (isStandalone) {
        window.open(window.location.href, "_blank", "noopener,noreferrer");
        toast.info("Opened the browser install page. Use the browser menu if the prompt is not shown.");
      } else {
        toast.info("Use your browser menu to install this role app, or refresh this install page.");
      }
      return;
    }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      if (role) {
        rememberInstalledRole(role);
        setInstalledRole(role);
      }
      clearPrompt();
      setHasPrompt(false);
    }
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
              onClick={() => navigate(`/install/${key}`)}
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
  const currentRoleInstalled = installedRole === role;

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

        <ShareLinksSection roleKey={role as AppRoleKey} shortName={config.shortName} />

        <PerRoleInstallStatePanel
          currentRole={role!}
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

interface ShareLinksSectionProps {
  roleKey: AppRoleKey;
  shortName: string;
}

const ShareLinksSection = ({ roleKey, shortName }: ShareLinksSectionProps) => {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://pay-palooza-go.lovable.app";
  const installUrl = `${origin}/install/${roleKey}`;
  const loginUrl = `${origin}${getLoginPathForRole(roleKey)}?app=${roleKey}`;

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
    { key: "login", label: `${shortName} login`, url: loginUrl },
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
  const installedRoles = readInstalledRoles();
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://pay-palooza-go.lovable.app";

  const clearRole = (roleKey: string) => {
    try {
      const next = installedRoles.filter((r) => r !== roleKey);
      localStorage.setItem(INSTALLED_ROLES_KEY, JSON.stringify(next));
      toast.success(`Cleared install state for ${ROLE_CONFIG[roleKey]?.shortName ?? roleKey}`);
      window.setTimeout(() => window.location.reload(), 400);
    } catch {
      toast.error("Could not clear install state");
    }
  };

  return (
    <div className="mb-6" data-testid="install-state-panel">
      <h2 className="text-sm font-bold text-foreground mb-3">Per-role install state</h2>
      <div className="space-y-2">
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
          const isCurrent = key === currentRole;
          const isInstalled = installedRoles.includes(key);
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
                  <p className="text-[10px] text-muted-foreground/70 font-mono truncate mt-1">
                    {origin}/install/{key}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {!isCurrent && (
                    <a
                      href={`/install/${key}`}
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
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground/70 mt-2">
        Install state is tracked locally per browser. Each role installs as its own PWA with a unique manifest id.
      </p>
    </div>
  );
};


