import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Download, Shield, BarChart3, Users, Smartphone, ShoppingBag, User, ArrowRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { getRoleInstallUrl } from "@/lib/rolePwaOrigins";
import type { InstallableRoleKey } from "@/lib/appRole";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type RoleEntry = {
  key: string;
  nameKey: TranslationKey;
  shortKey: TranslationKey;
  descKey: TranslationKey;
  icon: string;
  color: string;
  Icon: typeof Shield;
  installPath: string;
};

const ROLES: RoleEntry[] = [
  {
    key: "customer",
    nameKey: "ilpRoleCustomerName",
    shortKey: "ilpRoleCustomerShort",
    descKey: "ilpRoleCustomerDesc",
    icon: "/icons/icon-512.png",
    color: "from-emerald-500 to-teal-500",
    Icon: User,
    installPath: "/customer/install",
  },
  {
    key: "agent",
    nameKey: "ilpRoleAgentName",
    shortKey: "ilpRoleAgentShort",
    descKey: "ilpRoleAgentDesc",
    icon: "/icons/role-agent.png",
    color: "from-orange-500 to-amber-500",
    Icon: Smartphone,
    installPath: "/agent/install",
  },
  {
    key: "merchant",
    nameKey: "ilpRoleMerchantName",
    shortKey: "ilpRoleMerchantShort",
    descKey: "ilpRoleMerchantDesc",
    icon: "/icons/role-merchant.png",
    color: "from-rose-500 to-pink-500",
    Icon: ShoppingBag,
    installPath: "/merchant/install",
  },
  {
    key: "distributor",
    nameKey: "ilpRoleDistributorName",
    shortKey: "ilpRoleDistributorShort",
    descKey: "ilpRoleDistributorDesc",
    icon: "/icons/role-distributor.png",
    color: "from-blue-600 to-cyan-500",
    Icon: Users,
    installPath: "/distributor/install",
  },
  {
    key: "super-distributor",
    nameKey: "ilpRoleSDName",
    shortKey: "ilpRoleSDShort",
    descKey: "ilpRoleSDDesc",
    icon: "/icons/role-super-distributor.png",
    color: "from-violet-600 to-purple-500",
    Icon: BarChart3,
    installPath: "/super-distributor/install",
  },
  {
    key: "admin",
    nameKey: "ilpRoleAdminName",
    shortKey: "ilpRoleAdminShort",
    descKey: "ilpRoleAdminDesc",
    icon: "/icons/role-admin.png",
    color: "from-emerald-600 to-teal-500",
    Icon: Shield,
    installPath: "/admin/install",
  },
];

const InstallLandingPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("ilpLinkCopied").replace("{label}", label));
    } catch {
      toast.error(t("ilpCopyFail"));
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
            {t("ilpBadge")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            {t("ilpHeading")}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            {t("ilpSubheading")}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/install/all")}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:opacity-95 active:scale-[0.98] transition"
            >
              <Download size={15} />
              {t("ilpInstallAllGuided")}
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => navigate("/install/status")}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-accent transition"
            >
              {t("ilpInstallStatus")}
            </button>
          </div>
        </motion.div>
      </header>

      <main className="px-4 sm:px-6 pb-16 max-w-4xl mx-auto">
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((role, i) => {
            const url = getRoleInstallUrl(role.key as InstallableRoleKey);
            const Icon = role.Icon;
            const name = t(role.nameKey);
            const short = t(role.shortKey);
            const description = t(role.descKey);
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
                      {name}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {description}
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
                    aria-label={t("ilpInstallShort").replace("{short}", name)}
                  >
                    <Download size={14} />
                    {t("ilpInstallShort").replace("{short}", short)}
                    <ArrowRight size={14} className="opacity-80" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("ilpCopyLinkAria").replace("{short}", short)}
                    onClick={() => copy(url, short)}
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
          {t("ilpAlreadyInstalled")}
        </p>
      </main>
    </div>
  );
};

export default InstallLandingPage;
