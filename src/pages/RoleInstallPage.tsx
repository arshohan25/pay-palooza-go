import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Check, ArrowLeft, Smartphone, Shield, BarChart3, Users, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInstallPrompt, onPromptAvailable, isAppInstalled, clearPrompt } from "@/lib/installPromptStore";
import { useI18n } from "@/lib/i18n";

const ROLE_CONFIG: Record<string, {
  name: string;
  shortName: string;
  description: string;
  manifest: string;
  icon: string;
  color: string;
  LucideIcon: typeof Shield;
  features: string[];
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
  },
};

const RoleInstallPage = () => {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [hasPrompt, setHasPrompt] = useState(!!getInstallPrompt());
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const config = role ? ROLE_CONFIG[role] : null;

  // Swap manifest link for this role
  useEffect(() => {
    if (!config) return;
    const existing = document.querySelector('link[rel="manifest"]');
    const oldHref = existing?.getAttribute("href");
    if (existing) existing.setAttribute("href", config.manifest);
    return () => {
      if (existing && oldHref) existing.setAttribute("href", oldHref);
    };
  }, [config]);

  useEffect(() => {
    setIsStandalone(isAppInstalled());

    const unsub = onPromptAvailable(() => setHasPrompt(true));
    window.addEventListener("appinstalled", () => setInstalled(true));
    return unsub;
  }, []);

  const handleInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      clearPrompt();
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
          <h2 className="text-sm font-bold text-foreground mb-3">What's included</h2>
          <div className="grid grid-cols-2 gap-2">
            {config.features.map((f) => (
              <div key={f} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                <Check size={14} className="text-primary shrink-0" />
                <span className="text-xs text-foreground font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {installed || isStandalone ? (
            <motion.div key="installed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Check size={28} className="text-primary" />
              </div>
              <p className="font-bold text-foreground">App Installed!</p>
              <p className="text-sm text-muted-foreground mt-1">Check your home screen</p>
            </motion.div>
          ) : hasPrompt ? (
            <motion.div key="installable" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button
                onClick={handleInstall}
                className={`w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r ${config.color} text-white shadow-lg`}
              >
                <Download size={18} className="mr-2" />
                Install {config.shortName}
              </Button>
            </motion.div>
          ) : (
            <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3">
              <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                <Icon size={24} className="text-primary mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Install Manually</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>iPhone:</strong> Tap Share → "Add to Home Screen"
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <strong>Android:</strong> Tap ⋮ menu → "Install app"
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
