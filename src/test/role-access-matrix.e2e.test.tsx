/**
 * End-to-end role access matrix.
 *
 * Verifies that external users signed in under a specific role/installer
 * can reach ONLY the routes their role permits, and get redirected to the
 * matching role login otherwise.
 *
 * We render <RoleGuard> in isolation with mocked auth/role hooks so each
 * (role, route) combination is exercised deterministically without a live
 * Supabase session.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// ---- Mocks ---------------------------------------------------------------
const authState = { isAuthenticated: false, loading: false };
const rolesState: { roles: AppRole[]; loading: boolean } = { roles: [], loading: false };
const staffState = { isStaff: false, loading: false };

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/use-user-roles", () => ({ useUserRoles: () => rolesState }));
vi.mock("@/hooks/use-staff-access", () => ({ useStaffAccess: () => staffState }));

// ---- Route matrix --------------------------------------------------------
type GuardSpec = {
  path: string;
  allowed: AppRole[];
  loginRedirect: string;
  allowStaff?: boolean;
};

const ROUTE_MATRIX: GuardSpec[] = [
  { path: "/agent", allowed: ["agent"], loginRedirect: "/login/agent" },
  { path: "/distributor", allowed: ["distributor"], loginRedirect: "/login/distributor" },
  { path: "/super-distributor", allowed: ["super_distributor"], loginRedirect: "/login/super-distributor" },
  { path: "/merchant", allowed: ["merchant"], loginRedirect: "/login/merchant", allowStaff: true },
  {
    path: "/admin",
    allowed: ["admin", "compliance", "finance", "support", "operations", "marketing", "hr", "audit", "risk", "developer", "manager"],
    loginRedirect: "/login/admin",
  },
];

const ALL_ROLES: AppRole[] = [
  "agent",
  "distributor",
  "super_distributor",
  "merchant",
  "admin",
];

function renderGuarded(spec: GuardSpec) {
  return render(
    <MemoryRouter initialEntries={[spec.path]}>
      <Routes>
        <Route
          path={spec.path}
          element={
            <RoleGuard
              roles={spec.allowed}
              allowStaff={spec.allowStaff}
              unauthenticatedRedirect={spec.loginRedirect}
              unauthorizedRedirect={spec.loginRedirect}
            >
              <div data-testid="protected">PROTECTED::{spec.path}</div>
            </RoleGuard>
          }
        />
        <Route path={spec.loginRedirect} element={<div data-testid="login">LOGIN::{spec.loginRedirect}</div>} />
        <Route path="*" element={<div data-testid="other">OTHER</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function setAuth(signedIn: boolean, roles: AppRole[] = [], isStaff = false) {
  authState.isAuthenticated = signedIn;
  authState.loading = false;
  rolesState.roles = roles;
  rolesState.loading = false;
  staffState.isStaff = isStaff;
  staffState.loading = false;
}

// ---- Tests ---------------------------------------------------------------
describe("E2E role access matrix", () => {
  beforeEach(() => setAuth(false, []));

  describe("signed-out users are sent to the matching role login", () => {
    for (const spec of ROUTE_MATRIX) {
      it(`${spec.path} → ${spec.loginRedirect}`, () => {
        setAuth(false, []);
        renderGuarded(spec);
        expect(screen.getByTestId("login")).toHaveTextContent(spec.loginRedirect);
        expect(screen.queryByTestId("protected")).toBeNull();
      });
    }
  });

  describe("each role can only reach its own route", () => {
    for (const spec of ROUTE_MATRIX) {
      for (const role of ALL_ROLES) {
        const shouldAccess = spec.allowed.includes(role);
        it(`${role} @ ${spec.path} → ${shouldAccess ? "ALLOWED" : "DENIED"}`, () => {
          setAuth(true, [role]);
          renderGuarded(spec);
          if (shouldAccess) {
            expect(screen.getByTestId("protected")).toBeInTheDocument();
          } else {
            expect(screen.queryByTestId("protected")).toBeNull();
            expect(screen.getByTestId("login")).toHaveTextContent(spec.loginRedirect);
          }
        });
      }
    }
  });

  it("merchant route additionally allows linked staff (allowStaff)", () => {
    const spec = ROUTE_MATRIX.find((s) => s.path === "/merchant")!;
    setAuth(true, [], true); // signed in, no role, but staff-linked
    renderGuarded(spec);
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("staff access does NOT leak into non-merchant routes", () => {
    const spec = ROUTE_MATRIX.find((s) => s.path === "/admin")!;
    setAuth(true, [], true);
    renderGuarded(spec);
    expect(screen.queryByTestId("protected")).toBeNull();
    expect(screen.getByTestId("login")).toHaveTextContent("/login/admin");
  });

  it("admin-family roles (compliance/finance/support) can reach /admin", () => {
    const spec = ROUTE_MATRIX.find((s) => s.path === "/admin")!;
    for (const role of ["compliance", "finance", "support"] as AppRole[]) {
      setAuth(true, [role]);
      const { unmount } = renderGuarded(spec);
      expect(screen.getByTestId("protected")).toBeInTheDocument();
      unmount();
    }
  });

  it("shows loading spinner while auth is resolving instead of redirecting", () => {
    authState.isAuthenticated = false;
    authState.loading = true;
    rolesState.roles = [];
    rolesState.loading = true;
    staffState.isStaff = false;
    staffState.loading = false;
    renderGuarded(ROUTE_MATRIX[0]);
    expect(screen.queryByTestId("login")).toBeNull();
    expect(screen.queryByTestId("protected")).toBeNull();
  });
});
