/**
 * RBAC gate tests for `src/lib/distributorAdmin.ts`.
 *
 * We mock the Supabase client so we can drive:
 *  - the current session (with or without a user)
 *  - the roles returned from `user_roles`
 *  - the `has_permission` RPC (DB matrix)
 *
 * Then we assert that every mutating admin action fails fast when the caller
 * lacks the required permission, and succeeds when they hold it.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- Mock supabase client ---------------------------------------------------

type ScenarioRoles = string[];
type ScenarioRpc = boolean;
const state: {
  userId: string | null;
  roles: ScenarioRoles;
  hasPermission: ScenarioRpc;
  agentRow: any;
  distributorRow: any;
  updateCalls: string[];
} = {
  userId: "user-1",
  roles: [],
  hasPermission: false,
  agentRow: null,
  distributorRow: null,
  updateCalls: [],
};

function setScenario(patch: Partial<typeof state>) {
  Object.assign(state, patch);
  state.updateCalls = [];
}

vi.mock("@/integrations/supabase/client", () => {
  const chain = (result: any) => {
    const p: any = {
      select: () => p,
      insert: () => Promise.resolve({ error: null }),
      update: (patch: any) => {
        state.updateCalls.push(JSON.stringify(patch));
        return p;
      },
      delete: () => p,
      eq: () => p,
      in: () => Promise.resolve({ error: null }),
      neq: () => p,
      order: () => p,
      limit: () => p,
      maybeSingle: () => Promise.resolve(result),
      then: (fn: any) => Promise.resolve({ data: result.data ?? [], error: null }).then(fn),
    };
    return p;
  };

  return {
    supabase: {
      auth: {
        getSession: async () => ({
          data: { session: state.userId ? { user: { id: state.userId } } : null },
        }),
      },
      from: (table: string) => {
        if (table === "user_roles") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: state.roles.map((r) => ({ role: r })), error: null }),
            }),
          };
        }
        if (table === "agents") return chain({ data: state.agentRow });
        if (table === "distributors") return chain({ data: state.distributorRow });
        if (table === "audit_logs") {
          return { insert: () => ({ then: (fn: any) => Promise.resolve({ error: null }).then(fn) }) };
        }
        return chain({ data: null });
      },
      rpc: async (name: string) => {
        if (name === "has_permission") return { data: state.hasPermission, error: null };
        return { data: null, error: null };
      },
    },
  };
});

// Import AFTER the mock is registered.
import {
  assertAdmin,
  canManageDistributors,
  reassignAgent,
  removeTerritory,
  transferTerritory,
  bulkAssignAgents,
  bulkTransferDistributor,
  UnauthorizedError,
  ValidationError,
} from "@/lib/distributorAdmin";

let _uid = 0;
beforeEach(() => {
  setScenario({
    // Fresh user id per test — distributorAdmin caches roles per userId.
    userId: `user-${++_uid}`,
    roles: [],
    hasPermission: false,
    agentRow: { id: "agent-1", distributor_id: "dist-A", status: "active", business_name: "Agent 1" },
    distributorRow: { status: "active", territory: ["DHK", "CTG"] },
  });
});


describe("assertAdmin / canManageDistributors gates", () => {
  it("rejects an unauthenticated caller", async () => {
    setScenario({ userId: null, roles: [] });
    await expect(assertAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(await canManageDistributors()).toBe(false);
  });

  it("rejects a signed-in user with no admin role and no DB permission", async () => {
    setScenario({ roles: ["customer"], hasPermission: false });
    await expect(assertAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(await canManageDistributors()).toBe(false);
  });

  it("allows the built-in admin role", async () => {
    setScenario({ roles: ["admin"] });
    await expect(assertAdmin()).resolves.toMatchObject({ roles: ["admin"] });
    expect(await canManageDistributors()).toBe(true);
  });

  it("allows a user without the role when DB permission is granted", async () => {
    setScenario({ roles: ["support"], hasPermission: true });
    await expect(assertAdmin()).resolves.toBeTruthy();
    expect(await canManageDistributors()).toBe(true);
  });

  it("allows the legacy fallback roles (operations, manager, compliance)", async () => {
    for (const role of ["operations", "manager", "compliance"]) {
      setScenario({ roles: [role], hasPermission: false });
      await expect(assertAdmin()).resolves.toBeTruthy();
      expect(await canManageDistributors()).toBe(true);
    }
  });
});

describe("mutating actions all pass through assertAdmin", () => {
  const runners: Array<[string, () => Promise<unknown>]> = [
    ["reassignAgent", () => reassignAgent("agent-1", "dist-A", "dist-B")],
    ["bulkAssignAgents", () => bulkAssignAgents(["agent-1"], "dist-B")],
    ["removeTerritory", () => removeTerritory("DHK", "dist-A")],
    ["transferTerritory", () => transferTerritory("DHK", "dist-A", "dist-B")],
    ["bulkTransferDistributor", () => bulkTransferDistributor("dist-A", "dist-B", { agents: true, territories: true })],
  ];

  for (const [name, run] of runners) {
    it(`${name} throws UnauthorizedError when caller lacks permission`, async () => {
      setScenario({ roles: [], hasPermission: false });
      await expect(run()).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it(`${name} does NOT write to the DB when unauthorized`, async () => {
      setScenario({ roles: [], hasPermission: false });
      await run().catch(() => {});
      expect(state.updateCalls).toHaveLength(0);
    });
  }
});

describe("business validation still fires for authorized callers", () => {
  beforeEach(() => setScenario({ roles: ["admin"], hasPermission: true, agentRow: { id: "agent-1", distributor_id: "dist-A", status: "active", business_name: "Agent 1" }, distributorRow: { status: "active", territory: ["DHK"] } }));

  it("reassignAgent rejects a no-op re-link", async () => {
    await expect(reassignAgent("agent-1", "dist-A", "dist-A")).rejects.toBeInstanceOf(ValidationError);
  });

  it("removeTerritory rejects a code the distributor does not own", async () => {
    await expect(removeTerritory("SYL", "dist-A")).rejects.toBeInstanceOf(ValidationError);
  });

  it("transferTerritory rejects same source and target", async () => {
    await expect(transferTerritory("DHK", "dist-A", "dist-A")).rejects.toBeInstanceOf(ValidationError);
  });

  it("bulkTransferDistributor rejects same source and target", async () => {
    await expect(bulkTransferDistributor("dist-A", "dist-A", { agents: true, territories: true })).rejects.toBeInstanceOf(ValidationError);
  });
});
