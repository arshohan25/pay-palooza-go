import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Download, Shield, BarChart3, Users, Smartphone, ShoppingBag, User, ArrowRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { getRoleInstallUrl } from "@/lib/rolePwaOrigins";
import type { InstallableRoleKey } from "@/lib/appRole";

type RoleEntry = {
  key: string;
  name: string;
  short: string;
  description: string;
  icon: string;
  color: string;
  Icon: typeof Shield;
  installPath: string;
};

const ROLES: RoleEntry[] = [
  {
    key: "customer",
    name: "EasyPay",
    short: "Customer",
    description: "Send money, pay bills, shop, and manage your wallet.",
    icon: "/icons/icon-512.png",
    color: "from-emerald-500 to-teal-500",
    Icon: User,
    installPath: "/customer/install",
  },
  {
    key: "agent",
    name: "EasyPay Agent",
    short: "Agent",
    description: "Cash-in, cash-out, bill pay, and customer onboarding.",
    icon: "/icons/role-agent.png",
    color: "from-orange-500 to-amber-500",
    Icon: Smartphone,
    installPath: "/agent/install",
  },
  {
    key: "merchant",
    name: "EasyPay Merchant",
    short: "Merchant",
    description: "Accept payments, manage products, and track analytics.",
    icon: "/icons/role-merchant.png",
    color: "from-rose-500 to-pink-500",
    Icon: ShoppingBag,
    installPath: "/merchant/install",
  },
  {
    key: "distributor",
    name: "EasyPay Distributor",
    short: "Distributor",
    description: "Create agents, manage float, and track commissions.",
    icon: "/icons/role-distributor.png",
    color: "from-blue-600 to-cyan-500",
    Icon: Users,
    installPath: "/distributor/install",
  },
  {
    key: "super-distributor",
    name: "EasyPay Super Distributor",
    short: "Super Distributor",
    description: "Manage distributors, float allocation, and commission networks.",
    icon: "/icons/role-super-distributor.png",
    color: "from-violet-600 to-purple-500",
    Icon: BarChart3,
    installPath: "/super-distributor/install",
  },
  {
    key: "admin",
    name: "EasyPay Admin",
    short: "Admin",
    description: "Manage users, transactions, fraud alerts and settings.",
    icon: "/icons/role-admin.png",
    color: "from-emerald-600 to-teal-500",
    Icon: Shield,
    installPath: "/admin/install",
  },
];

const InstallLandingPage = () => {
  const navigate = useNavigate();
  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} link copied`);
    } catch {
      toast.error("Could not copy — long-press the link to copy manually");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 pt-12 pb-8 text-center bg-gradient-to-br from-primary/10 via-background to-background">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-4">
            <Download size={12} />
            Install EasyPay
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Get the right app for your role
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            Each installer opens a role-specific PWA that binds to your account
            type and launches straight into the correct dashboard.
          </p>
        </motion.div>
      </header>

      <main className="px-4 sm:px-6 pb-16 max-w-4xl mx-auto">
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((role, i) => {
            const url = getRoleInstallUrl(role.key as InstallableRoleKey);
            const Icon = role.Icon;
            return (
              <motion.article
                key={role.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all"
              >
                <div
                  className={`absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity bg-gradient-to-br ${role.color}`}
                  aria-hidden
                />
                <div className="relative flex items-start gap-3">
                  <div
                    className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center shadow-lg`}
                  >
                    <Icon size={22} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-foreground truncate">
                      {role.name}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {role.description}
                    </p>
                  </div>
                </div>

                <div className="relative mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = getRoleInstallUrl(role.key as InstallableRoleKey);
                      if (target.startsWith(window.location.origin)) {
                        navigate(role.installPath);
                      } else {
                        window.location.href = target;
                      }
                    }}
                    className={`flex-1 h-10 rounded-xl bg-gradient-to-r ${role.color} text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-1.5 hover:opacity-95 active:scale-[0.98] transition`}
                    aria-label={`Install ${role.name}`}
                  >
                    <Download size={14} />
                    Install {role.short}
                    <ArrowRight size={14} className="opacity-80" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Copy ${role.short} install link`}
                    onClick={() => copy(url, role.short)}
                    className="h-10 w-10 rounded-xl border border-border bg-background hover:bg-accent transition-colors flex items-center justify-center"
                  >
                    <Copy size={14} className="text-foreground" />
                  </button>
                </div>

                <p className="relative mt-2 text-[11px] text-muted-foreground truncate font-mono">
                  {url}
                </p>
              </motion.article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Already installed? Just launch the app from your home screen — it will
          route to the right login automatically.
        </p>
      </main>
    </div>
  );
};

export default InstallLandingPage;
