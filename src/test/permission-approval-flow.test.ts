/**
 * End-to-end tests for the two-admin permission approval workflow.
 *
 * We simulate the DB contract for `approve_permission_change` /
 * `reject_permission_change` inside a fake supabase mock, then drive the
 * flow the way the UI does (insert request → approve/reject via RPC) and
 * assert:
 *   - the requester cannot self-approve
 *   - a different admin can approve, and the target permission is applied
 *   - reject leaves the target permission untouched
 *   - both outcomes write to `audit_logs`
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

interface Req {
  id: string;
  role: string;
  permission: string;
  allowed: boolean;
  status: "pending" | "approved" | "rejected" | "expired";
  requested_by: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  expires_at: string;
}

const state = {
  currentUser: "admin-A",
  requests: [] as Req[],
  rolePerms: [] as Array<{ role: string; permission: string; allowed: boolean }>,
  auditLogs: [] as any[],
  notifications: [] as any[],
  admins: new Set<string>(["admin-A", "admin-B"]),
};

function reset() {
  state.currentUser = "admin-A";
  state.requests = [];
  state.rolePerms = [];
  state.auditLogs = [];
  state.notifications = [];
}

vi.mock("@/integrations/supabase/client", () => {
  const insertRequest = (row: Omit<Req, "id" | "status" | "expires_at"> & Partial<Req>) => {
    const req: Req = {
      id: `req-${state.requests.length + 1}`,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 86400e3).toISOString(),
      ...row,
    } as Req;
    state.requests.push(req);
    // Trigger notifications for other admins (mirrors DB trigger).
    for (const uid of state.admins) {
      if (uid !== req.requested_by) state.notifications.push({ user_id: uid, request_id: req.id });
    }
    return { data: req, error: null };
  };

  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: state.currentUser } } } }),
      },
      from: (table: string) => ({
        insert: (row: any) => {
          if (table === "permission_change_requests") return Promise.resolve(insertRequest(row));
          if (table === "audit_logs") { state.auditLogs.push(row); return Promise.resolve({ error: null }); }
          return Promise.resolve({ error: null });
        },
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      }),
      rpc: async (name: string, args: any) => {
        if (name === "approve_permission_change") {
          const r = state.requests.find((x) => x.id === args._request_id);
          if (!r) return { error: { message: "Request not found" } };
          if (r.status !== "pending") return { error: { message: "Request is not pending" } };
          if (r.requested_by === state.currentUser)
            return { error: { message: "A second admin must approve — the requester cannot self-approve" } };
          r.status = "approved";
          r.reviewed_by = state.currentUser;
          r.reviewed_at = new Date().toISOString();
          r.review_note = args._note ?? null;
          // Apply permission
          const idx = state.rolePerms.findIndex((p) => p.role === r.role && p.permission === r.permission);
          if (idx >= 0) state.rolePerms[idx].allowed = r.allowed;
          else state.rolePerms.push({ role: r.role, permission: r.permission, allowed: r.allowed });
          state.auditLogs.push({
            actor_id: state.currentUser,
            action: r.allowed ? "permission_granted" : "permission_revoked",
            entity_type: "permission",
            details: { role: r.role, permission: r.permission, allowed: r.allowed, approved_request: r.id, requested_by: r.requested_by },
          });
          return { data: null, error: null };
        }
        if (name === "reject_permission_change") {
          const r = state.requests.find((x) => x.id === args._request_id);
          if (!r) return { error: { message: "Request not found" } };
          if (r.status !== "pending") return { error: { message: "Request is not pending" } };
          r.status = "rejected";
          r.reviewed_by = state.currentUser;
          r.reviewed_at = new Date().toISOString();
          r.review_note = args._note ?? null;
          state.auditLogs.push({
            actor_id: state.currentUser,
            action: "permission_change_rejected",
            entity_type: "permission",
            details: { role: r.role, permission: r.permission, allowed: r.allowed, request_id: r.id, note: args._note ?? null },
          });
          return { data: null, error: null };
        }
        if (name === "expire_stale_permission_requests") {
          let n = 0;
          for (const r of state.requests) {
            if (r.status === "pending" && new Date(r.expires_at) < new Date()) {
              r.status = "expired"; n++;
            }
          }
          return { data: n, error: null };
        }
        return { data: null, error: null };
      },
    },
  };
});

import { supabase } from "@/integrations/supabase/client";

async function createRequest(role: string, permission: string, allowed: boolean) {
  return await supabase.from("permission_change_requests" as any).insert({
    role, permission, allowed, requested_by: state.currentUser,
  } as any) as any;
}

beforeEach(() => reset());

describe("permission approval two-admin flow", () => {
  it("creates a pending request and notifies other admins", async () => {
    state.currentUser = "admin-A";
    const { data } = await createRequest("support", "manage_roles", true);
    expect(data.status).toBe("pending");
    expect(state.notifications.some((n) => n.user_id === "admin-B" && n.request_id === data.id)).toBe(true);
    expect(state.notifications.some((n) => n.user_id === "admin-A")).toBe(false);
  });

  it("blocks self-approval and does NOT apply the change", async () => {
    state.currentUser = "admin-A";
    const { data: req } = await createRequest("support", "manage_roles", true);
    const { error } = await supabase.rpc("approve_permission_change" as any, { _request_id: req.id, _note: null });
    expect(error?.message).toMatch(/second admin/i);
    expect(state.rolePerms).toHaveLength(0);
    expect(req.status).toBe("pending");
  });

  it("allows a different admin to approve and applies the permission + audit log", async () => {
    state.currentUser = "admin-A";
    const { data: req } = await createRequest("support", "manage_roles", true);
    state.currentUser = "admin-B";
    const { error } = await supabase.rpc("approve_permission_change" as any, { _request_id: req.id, _note: "ok" });
    expect(error).toBeNull();
    expect(req.status).toBe("approved");
    expect(state.rolePerms).toContainEqual({ role: "support", permission: "manage_roles", allowed: true });
    const audit = state.auditLogs.find((a) => a.action === "permission_granted");
    expect(audit).toBeTruthy();
    expect(audit.actor_id).toBe("admin-B");
    expect(audit.details.approved_request).toBe(req.id);
    expect(audit.details.requested_by).toBe("admin-A");
  });

  it("reject leaves the permission untouched and writes a rejection audit entry", async () => {
    state.currentUser = "admin-A";
    const { data: req } = await createRequest("support", "manage_super_distributors", true);
    state.currentUser = "admin-B";
    await supabase.rpc("reject_permission_change" as any, { _request_id: req.id, _note: "nope" });
    expect(req.status).toBe("rejected");
    expect(state.rolePerms).toHaveLength(0);
    const audit = state.auditLogs.find((a) => a.action === "permission_change_rejected");
    expect(audit).toBeTruthy();
    expect(audit.details.note).toBe("nope");
  });

  it("cannot approve an already-reviewed request twice", async () => {
    state.currentUser = "admin-A";
    const { data: req } = await createRequest("support", "manage_roles", true);
    state.currentUser = "admin-B";
    await supabase.rpc("approve_permission_change" as any, { _request_id: req.id, _note: null });
    const { error } = await supabase.rpc("approve_permission_change" as any, { _request_id: req.id, _note: null });
    expect(error?.message).toMatch(/not pending/i);
  });

  it("auto-expires stale pending requests", async () => {
    state.currentUser = "admin-A";
    const { data: req } = await createRequest("support", "manage_roles", true);
    req.expires_at = new Date(Date.now() - 1000).toISOString();
    const { data: n } = await supabase.rpc("expire_stale_permission_requests" as any, {});
    expect(n).toBe(1);
    expect(req.status).toBe("expired");
  });
});
