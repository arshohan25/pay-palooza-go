import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth, signOut } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { getBoundAppRole, APP_ROLE_LABEL } from "@/lib/appRole";
import { ShieldAlert, ArrowRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Full-screen, non-dismissable overlay shown when a signed-in user holds an
 * elevated role (agent/merchant/distributor/super_distributor/admin) but is
 * viewing the customer surface. Replaces the previous silent auto-redirect
 * so the user understands *why* they are being moved and can take action
 * themselves rather than being bounced without explanation.
 */
const ELEVATED = ["agent", "merchant", "distributor", "super_distributor", "admin"] as const;
type ElevatedRole = typeof ELEVATED[number];

const PORTAL: Record<ElevatedRole, string> = {
  agent: "/agent/login",
  merchant: "/merchant-login",
  distributor: "/distributor/login",
  super_distributor: "/super-distributor/login",
  admin: "/admin/login",
};

const ROLE_PORTAL_PREFIXES = [
  "/agent", "/merchant", "/admin",
  "/distributor", "/super-distributor", "/sd",
  "/install", "/staff", "/team",
];

const ElevatedRoleBlockOverlay = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  const inScope = !authLoading && !rolesLoading && isAuthenticated;
  const onPortalPath = ROLE_PORTAL_PREFIXES.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  );
  const boundRole = getBoundAppRole();

  const elevated = ((roles as string[]) ?? []).find((r) =>
    (ELEVATED as readonly string[]).includes(r),
  ) as ElevatedRole | undefined;

  const shouldShow =
    inScope && !boundRole && !onPortalPath && !!elevated;

  // Prevent body scroll while shown
  useEffect(() => {
    if (!shouldShow) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [shouldShow]);

  if (!shouldShow || !elevated) return null;

  const label = APP_ROLE_LABEL[elevated as keyof typeof APP_ROLE_LABEL] ?? elevated;
  const portalPath = PORTAL[elevated];

  const handleGoToPortal = async () => {
    setSigningOut(true);
    try { await signOut(); } catch {}
    window.location.href = portalPath;
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); } catch {}
    window.location.href = "/";
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="elevated-role-block-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/85 backdrop-blur-xl p-5 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-[19px] border border-white/10 bg-card/95 shadow-2xl p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2
          id="elevated-role-block-title"
          className="text-lg font-semibold text-foreground"
        >
          Wrong app for this account
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          This number is registered as a <span className="font-semibold text-foreground">{label}</span> account
          and cannot be used inside the customer app. Please continue from
          the {label} portal instead.
        </p>

        <div className="mt-5 space-y-2">
          <Button
            onClick={handleGoToPortal}
            disabled={signingOut}
            className="w-full h-11 rounded-xl"
          >
            Open {label} portal
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          <Button
            onClick={handleSignOut}
            disabled={signingOut}
            variant="outline"
            className="w-full h-11 rounded-xl"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign out
          </Button>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground/80">
          Each role has its own dedicated app for security and compliance.
        </p>
      </div>
    </div>
  );
};

export default ElevatedRoleBlockOverlay;
