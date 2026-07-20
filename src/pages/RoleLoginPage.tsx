import { lazy, Suspense, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Shield, Smartphone, BarChart3, Users, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useI18n } from "@/lib/i18n";
import {
  APP_ROLE_ALLOWED,
  APP_ROLE_HOME,
  APP_ROLE_LABEL,
  isRoleAllowedForApp,
  type AppRoleKey,
} from "@/lib/appRole";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const AgentLoginPage = lazy(() => import("@/pages/AgentLoginPage"));
const DistributorLoginPage = lazy(() => import("@/pages/DistributorLoginPage"));
const SuperDistributorLoginPage = lazy(() => import("@/pages/SuperDistributorLoginPage"));
const AdminLoginPage = lazy(() => import("@/pages/AdminLoginPage"));
const MerchantLoginPage = lazy(() => import("@/pages/MerchantLoginPage"));

const ROLE_META: Record<
  AppRoleKey,
  { icon: typeof Shield; gradient: string; favicon: string; taglineKey: string; descKey: string }
> = {
  admin: {
    icon: Shield,
    gradient: "from-emerald-600 to-teal-500",
    favicon: "/icons/role-admin.png",
    taglineKey: "rlpTaglineAdmin",
    descKey: "rlpDescAdmin",
  },
  agent: {
    icon: Smartphone,
    gradient: "from-orange-500 to-amber-500",
    favicon: "/icons/role-agent.png",
    taglineKey: "rlpTaglineAgent",
    descKey: "rlpDescAgent",
  },
  merchant: {
    icon: ShoppingBag,
    gradient: "from-rose-500 to-pink-500",
    favicon: "/icons/role-merchant.png",
    taglineKey: "rlpTaglineMerchant",
    descKey: "rlpDescMerchant",
  },
  distributor: {
    icon: Users,
    gradient: "from-blue-600 to-cyan-500",
    favicon: "/icons/role-distributor.png",
    taglineKey: "rlpTaglineDistributor",
    descKey: "rlpDescDistributor",
  },
  "super-distributor": {
    icon: BarChart3,
    gradient: "from-violet-600 to-purple-500",
    favicon: "/icons/role-super-distributor.png",
    taglineKey: "rlpTaglineSD",
    descKey: "rlpDescSD",
  },
};

const RoleLoginPage = () => {
  const { role } = useParams<{ role: AppRoleKey }>();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const { t } = useI18n();

  const roleKey = role && role in APP_ROLE_ALLOWED ? (role as AppRoleKey) : null;

  useEffect(() => {
    if (!roleKey) return;
    if (authLoading || rolesLoading) return;
    if (!isAuthenticated) return;
    if (isRoleAllowedForApp(roleKey, roles as string[])) {
      navigate(APP_ROLE_HOME[roleKey], { replace: true });
    }
  }, [isAuthenticated, authLoading, rolesLoading, roles, roleKey, navigate]);

  if (!roleKey) return <Navigate to="/install" replace />;

  const DedicatedLogin =
    roleKey === "agent"
      ? AgentLoginPage
      : roleKey === "distributor"
        ? DistributorLoginPage
        : roleKey === "super-distributor"
          ? SuperDistributorLoginPage
          : roleKey === "admin"
            ? AdminLoginPage
            : roleKey === "merchant"
              ? MerchantLoginPage
              : null;

  if (DedicatedLogin) {
    return (
      <Suspense fallback={null}>
        <DedicatedLogin />
      </Suspense>
    );
  }

  const meta = ROLE_META[roleKey];
  const Icon = meta.icon;
  const tagline = t(meta.taglineKey as any);
  const description = t(meta.descKey as any);
  const title = t("rlpSignInSuffix", { role: APP_ROLE_LABEL[roleKey] });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="icon" href={meta.favicon} />
        <link rel="apple-touch-icon" href={meta.favicon} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
      </Helmet>
      <header
        className={`bg-gradient-to-br ${meta.gradient} text-white px-6 pt-10 pb-8 text-center`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
          <Icon size={28} />
        </div>
        <h1 className="text-xl font-extrabold">{APP_ROLE_LABEL[roleKey]}</h1>
        <p className="text-sm opacity-90 mt-1">{tagline}</p>
      </header>
      <div className="flex-1 relative">
        <Suspense fallback={null}>
          <AuthPage
            onAuthenticated={() => {
              localStorage.setItem("mfs_has_authenticated", "1");
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default RoleLoginPage;

