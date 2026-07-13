import { lazy, Suspense, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
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

const ROLE_META: Record<AppRoleKey, { icon: typeof Shield; gradient: string; tagline: string }> = {
  admin: {
    icon: Shield,
    gradient: "from-emerald-600 to-teal-500",
    tagline: "Sign in with your admin / team account.",
  },
  agent: {
    icon: Smartphone,
    gradient: "from-orange-500 to-amber-500",
    tagline: "Sign in with your agent phone number & PIN.",
  },
  merchant: {
    icon: ShoppingBag,
    gradient: "from-rose-500 to-pink-500",
    tagline: "Sign in with your merchant account.",
  },
  distributor: {
    icon: Users,
    gradient: "from-blue-600 to-cyan-500",
    tagline: "Sign in with your distributor phone number & PIN.",
  },
  "super-distributor": {
    icon: BarChart3,
    gradient: "from-violet-600 to-purple-500",
    tagline: "Sign in with your super-distributor account.",
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
    // If role mismatch, AppRoleEnforcer handles the sign-out + toast.
  }, [isAuthenticated, authLoading, rolesLoading, roles, roleKey, navigate]);

  if (!roleKey) return <Navigate to="/install" replace />;

  const meta = ROLE_META[roleKey];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className={`bg-gradient-to-br ${meta.gradient} text-white px-6 pt-10 pb-8 text-center`}>
        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
          <Icon size={28} />
        </div>
        <h1 className="text-xl font-extrabold">{APP_ROLE_LABEL[roleKey]}</h1>
        <p className="text-sm opacity-90 mt-1">{meta.tagline}</p>
      </div>
      <div className="flex-1 relative">
        <Suspense fallback={null}>
          <AuthPage
            onAuthenticated={() => {
              localStorage.setItem("mfs_has_authenticated", "1");
              // Navigation happens in the effect above once roles resolve.
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default RoleLoginPage;
