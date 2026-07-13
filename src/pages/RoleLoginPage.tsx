import { lazy, Suspense, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Shield, Smartphone, BarChart3, Users, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  APP_ROLE_ALLOWED,
  APP_ROLE_HOME,
  APP_ROLE_LABEL,
  isRoleAllowedForApp,
  type AppRoleKey,
} from "@/lib/appRole";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const AgentLoginPage = lazy(() => import("@/pages/AgentLoginPage"));

const ROLE_META: Record<
  AppRoleKey,
  { icon: typeof Shield; gradient: string; tagline: string; favicon: string; description: string }
> = {
  admin: {
    icon: Shield,
    gradient: "from-emerald-600 to-teal-500",
    tagline: "Sign in with your admin / team account.",
    favicon: "/icons/role-admin.png",
    description: "EasyPay Admin – manage users, transactions, fraud alerts and platform settings.",
  },
  agent: {
    icon: Smartphone,
    gradient: "from-orange-500 to-amber-500",
    tagline: "Sign in with your agent phone number & PIN.",
    favicon: "/icons/role-agent.png",
    description: "EasyPay Agent – cash-in, cash-out, bill pay and customer onboarding.",
  },
  merchant: {
    icon: ShoppingBag,
    gradient: "from-rose-500 to-pink-500",
    tagline: "Sign in with your merchant account.",
    favicon: "/icons/role-merchant.png",
    description: "EasyPay Merchant – accept payments, manage products and track analytics.",
  },
  distributor: {
    icon: Users,
    gradient: "from-blue-600 to-cyan-500",
    tagline: "Sign in with your distributor phone number & PIN.",
    favicon: "/icons/role-distributor.png",
    description: "EasyPay Distributor – create agents, manage float and track commissions.",
  },
  "super-distributor": {
    icon: BarChart3,
    gradient: "from-violet-600 to-purple-500",
    tagline: "Sign in with your super-distributor account.",
    favicon: "/icons/role-super-distributor.png",
    description: "EasyPay Super Distributor – manage distributors, float and commission networks.",
  },
};

const RoleLoginPage = () => {
  const { role } = useParams<{ role: AppRoleKey }>();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();

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

  const meta = ROLE_META[roleKey];
  const Icon = meta.icon;
  const title = `${APP_ROLE_LABEL[roleKey]} — Sign in`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={meta.description} />
        <link rel="icon" href={meta.favicon} />
        <link rel="apple-touch-icon" href={meta.favicon} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={meta.description} />
      </Helmet>
      <header
        className={`bg-gradient-to-br ${meta.gradient} text-white px-6 pt-10 pb-8 text-center`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
          <Icon size={28} />
        </div>
        <h1 className="text-xl font-extrabold">{APP_ROLE_LABEL[roleKey]}</h1>
        <p className="text-sm opacity-90 mt-1">{meta.tagline}</p>
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
