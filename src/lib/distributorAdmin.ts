import { supabase } from "@/integrations/supabase/client";

/* -------------------------------------------------------------------------- */
/*  RBAC                                                                       */
/* -------------------------------------------------------------------------- */

/** Roles allowed to mutate distributor/agent links + territories. */
const AUTHORIZED_ROLES = new Set([
  "admin",
  "manager",
  "operations",
  "compliance",
]);

export class UnauthorizedError extends Error {
  constructor(msg = "You don't have permission to perform this action") {
    super(msg);
    this.name = "UnauthorizedError";
  }
}
export class ValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ValidationError";
  }
}

let cachedRoles: { userId: string; roles: string[] } | null = null;

async function currentRoles(): Promise<{ userId: string; roles: string[] }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new UnauthorizedError("Sign in required");
  if (cachedRoles?.userId === session.user.id) return cachedRoles;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);
  const roles = ((data ?? []) as any[]).map((r) => r.role as string);
  cachedRoles = { userId: session.user.id, roles };
  return cachedRoles;
}

/** Ask the DB whether the current user has a permission. */
async function hasDbPermission(permission: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;
  const { data, error } = await supabase.rpc("has_permission" as any, {
    _user_id: session.user.id,
    _permission: permission,
  });
  if (error) return false;
  return !!data;
}

/**
 * Throws UnauthorizedError unless the caller has the required permission
 * (via the DB matrix) or is a hardcoded fallback admin role.
 */
export async function assertAdmin(permission = "manage_distributors"): Promise<{ userId: string; roles: string[] }> {
  const info = await currentRoles();
  if (info.roles.includes("admin")) return info;
  if (await hasDbPermission(permission)) return info;
  if (info.roles.some((r) => AUTHORIZED_ROLES.has(r))) return info;
  throw new UnauthorizedError(
    "You don't have permission for this action. Ask an admin to grant it in Roles & Permissions.",
  );
}

/** Non-throwing gate for UI (hide/disable actions). */
export async function canManageDistributors(): Promise<boolean> {
  try {
    const info = await currentRoles();
    if (info.roles.includes("admin")) return true;
    if (await hasDbPermission("manage_distributors")) return true;
    return info.roles.some((r) => AUTHORIZED_ROLES.has(r));
  } catch { return false; }
}


/* -------------------------------------------------------------------------- */
/*  Audit                                                                      */
/* -------------------------------------------------------------------------- */

async function audit(action: string, entity_type: string, entity_id: string, details: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  supabase.from("audit_logs").insert({
    actor_id: session.user.id,
    action,
    entity_type,
    entity_id,
    details,
  }).then();
}

/* -------------------------------------------------------------------------- */
/*  Agent link / unlink / transfer                                             */
/* -------------------------------------------------------------------------- */

async function fetchDistributorStatus(id: string): Promise<string | null> {
  const { data } = await supabase.from("distributors").select("status").eq("id", id).maybeSingle();
  return (data?.status as string) ?? null;
}

export interface ReassignResult {
  /** Previous distributor_id for undo. */
  prevDistId: string | null;
  agentId: string;
}

/**
 * Assign / re-assign / unassign a single agent to a distributor.
 * Pass null to unlink. Validates: same-source, target status, cross-links.
 */
export async function reassignAgent(
  agentId: string,
  fromDistId: string | null,
  toDistId: string | null,
): Promise<ReassignResult> {
  await assertAdmin();

  // Load live agent row — never trust the stale UI copy.
  const { data: agent, error: agErr } = await supabase
    .from("agents")
    .select("id, distributor_id, status, business_name")
    .eq("id", agentId)
    .maybeSingle();
  if (agErr) throw agErr;
  if (!agent) throw new ValidationError("Agent not found");

  const actualFrom = (agent as any).distributor_id as string | null;

  if (actualFrom === toDistId) {
    throw new ValidationError(
      toDistId
        ? "Agent is already linked to this distributor"
        : "Agent is already unassigned",
    );
  }
  if (fromDistId && actualFrom !== fromDistId) {
    throw new ValidationError(
      "This agent has already been moved by someone else. Refresh and try again.",
    );
  }
  if ((agent as any).status === "suspended" && toDistId) {
    throw new ValidationError("Cannot link a suspended agent — reactivate it first");
  }

  if (toDistId) {
    const status = await fetchDistributorStatus(toDistId);
    if (!status) throw new ValidationError("Target distributor not found");
    if (status === "suspended") throw new ValidationError("Target distributor is suspended");
  }

  const { error } = await supabase
    .from("agents")
    .update({ distributor_id: toDistId })
    .eq("id", agentId);
  if (error) throw error;

  const action = !actualFrom
    ? "agent_assigned"
    : !toDistId
      ? "agent_unassigned"
      : "agent_transferred";
  await audit(action, "agent", agentId, { from: actualFrom, to: toDistId });

  return { prevDistId: actualFrom, agentId };
}

export interface BulkAssignResult {
  succeeded: number;
  failed: number;
  /** Per-agent previous distributor_id for undo. */
  prev: Record<string, string | null>;
}

/** Bulk assign a set of agents to a single distributor. */
export async function bulkAssignAgents(
  agentIds: string[],
  toDistId: string | null,
): Promise<BulkAssignResult> {
  await assertAdmin();
  if (agentIds.length === 0) return { succeeded: 0, failed: 0, prev: {} };

  if (toDistId) {
    const status = await fetchDistributorStatus(toDistId);
    if (!status) throw new ValidationError("Target distributor not found");
    if (status === "suspended") throw new ValidationError("Target distributor is suspended");
  }

  // Snapshot for undo + skip no-ops.
  const { data: existing } = await supabase
    .from("agents").select("id, distributor_id, status").in("id", agentIds);
  const prev: Record<string, string | null> = {};
  const toUpdate: string[] = [];
  let skipped = 0;
  for (const row of (existing ?? []) as any[]) {
    prev[row.id] = row.distributor_id ?? null;
    if (row.distributor_id === toDistId) { skipped++; continue; }
    if (row.status === "suspended" && toDistId) { skipped++; continue; }
    toUpdate.push(row.id);
  }
  if (toUpdate.length === 0) {
    return { succeeded: 0, failed: skipped, prev };
  }

  const { error } = await supabase
    .from("agents")
    .update({ distributor_id: toDistId })
    .in("id", toUpdate);
  if (error) return { succeeded: 0, failed: agentIds.length, prev };

  await audit(
    toDistId ? "agents_bulk_assigned" : "agents_bulk_unassigned",
    "agent",
    "bulk",
    { count: toUpdate.length, to: toDistId, agent_ids: toUpdate },
  );
  return { succeeded: toUpdate.length, failed: skipped, prev };
}

/** Undo helper — restore each agent to its previous distributor. */
export async function undoBulkAssign(prev: Record<string, string | null>) {
  await assertAdmin();
  const entries = Object.entries(prev);
  await Promise.all(entries.map(([id, distId]) =>
    supabase.from("agents").update({ distributor_id: distId }).eq("id", id),
  ));
  await audit("agents_bulk_undo", "agent", "bulk", { count: entries.length });
}

/* -------------------------------------------------------------------------- */
/*  Territory ops                                                              */
/* -------------------------------------------------------------------------- */

async function readTerritory(distId: string): Promise<string[]> {
  const { data } = await supabase.from("distributors").select("territory").eq("id", distId).maybeSingle();
  return ((data?.territory ?? []) as string[]);
}

/** Move a territory code from one distributor to another. */
export async function transferTerritory(
  code: string,
  fromDistId: string,
  toDistId: string,
) {
  await assertAdmin();
  if (!code.trim()) throw new ValidationError("Territory code required");
  if (fromDistId === toDistId) throw new ValidationError("Source and target must differ");

  const toStatus = await fetchDistributorStatus(toDistId);
  if (!toStatus) throw new ValidationError("Target distributor not found");
  if (toStatus === "suspended") throw new ValidationError("Target distributor is suspended");

  const [fromT, toT] = await Promise.all([readTerritory(fromDistId), readTerritory(toDistId)]);
  if (!fromT.includes(code)) throw new ValidationError(`Source no longer owns "${code}"`);
  if (toT.includes(code)) throw new ValidationError(`Target already owns "${code}"`);

  const nextFrom = fromT.filter((c) => c !== code);
  const nextTo = [...toT, code];
  const [r1, r2] = await Promise.all([
    supabase.from("distributors").update({ territory: nextFrom.length ? nextFrom : null }).eq("id", fromDistId),
    supabase.from("distributors").update({ territory: nextTo }).eq("id", toDistId),
  ]);
  if (r1.error || r2.error) throw (r1.error || r2.error);
  await audit("territory_transferred", "distributor", toDistId, { code, from: fromDistId, to: toDistId });
}

/** Remove a territory code from a distributor. */
export async function removeTerritory(code: string, distId: string) {
  await assertAdmin();
  const t = await readTerritory(distId);
  if (!t.includes(code)) throw new ValidationError(`Distributor does not own "${code}"`);
  const next = t.filter((c) => c !== code);
  const { error } = await supabase
    .from("distributors")
    .update({ territory: next.length ? next : null })
    .eq("id", distId);
  if (error) throw error;
  await audit("territory_removed", "distributor", distId, { code });
}

/** Add / restore a territory code on a distributor (used for undo). */
export async function addTerritory(code: string, distId: string) {
  await assertAdmin();
  const t = await readTerritory(distId);
  if (t.includes(code)) return;
  const { error } = await supabase
    .from("distributors")
    .update({ territory: [...t, code] })
    .eq("id", distId);
  if (error) throw error;
  await audit("territory_added", "distributor", distId, { code });
}

/* -------------------------------------------------------------------------- */
/*  Bulk transfer                                                              */
/* -------------------------------------------------------------------------- */

export interface BulkTransferResult {
  agentCount: number;
  territoryCount: number;
  /** For undo: agents that were moved (all had fromDistId before). */
  movedAgentIds: string[];
  /** For undo: territories that were moved (source lost these). */
  movedTerritories: string[];
  fromDistId: string;
  toDistId: string;
}

/** Move ALL agents and/or territories from one distributor to another. */
export async function bulkTransferDistributor(
  fromDistId: string,
  toDistId: string,
  opts: { agents: boolean; territories: boolean },
): Promise<BulkTransferResult> {
  await assertAdmin();
  if (fromDistId === toDistId) throw new ValidationError("Source and target must differ");
  const toStatus = await fetchDistributorStatus(toDistId);
  if (!toStatus) throw new ValidationError("Target distributor not found");
  if (toStatus === "suspended") throw new ValidationError("Target distributor is suspended");

  let movedAgentIds: string[] = [];
  let movedTerritories: string[] = [];

  if (opts.agents) {
    const { data: agents } = await supabase
      .from("agents").select("id").eq("distributor_id", fromDistId);
    movedAgentIds = ((agents ?? []) as any[]).map((a) => a.id);
    if (movedAgentIds.length > 0) {
      const { error } = await supabase
        .from("agents").update({ distributor_id: toDistId }).in("id", movedAgentIds);
      if (error) throw error;
    }
  }

  if (opts.territories) {
    const [fromT, toT] = await Promise.all([readTerritory(fromDistId), readTerritory(toDistId)]);
    if (fromT.length > 0) {
      movedTerritories = fromT.filter((c) => !toT.includes(c));
      const merged = Array.from(new Set([...toT, ...fromT]));
      const [r1, r2] = await Promise.all([
        supabase.from("distributors").update({ territory: null }).eq("id", fromDistId),
        supabase.from("distributors").update({ territory: merged }).eq("id", toDistId),
      ]);
      if (r1.error || r2.error) throw (r1.error || r2.error);
    }
  }

  await audit("distributor_bulk_transferred", "distributor", toDistId, {
    from: fromDistId,
    to: toDistId,
    agents: movedAgentIds.length,
    territories: movedTerritories.length,
  });
  return {
    agentCount: movedAgentIds.length,
    territoryCount: movedTerritories.length,
    movedAgentIds,
    movedTerritories,
    fromDistId,
    toDistId,
  };
}

/** Undo a bulk transfer. */
export async function undoBulkTransfer(r: BulkTransferResult) {
  await assertAdmin();
  if (r.movedAgentIds.length > 0) {
    await supabase.from("agents").update({ distributor_id: r.fromDistId }).in("id", r.movedAgentIds);
  }
  if (r.movedTerritories.length > 0) {
    const [fromT, toT] = await Promise.all([readTerritory(r.fromDistId), readTerritory(r.toDistId)]);
    const restoredFrom = Array.from(new Set([...fromT, ...r.movedTerritories]));
    const restoredTo = toT.filter((c) => !r.movedTerritories.includes(c));
    await Promise.all([
      supabase.from("distributors").update({ territory: restoredFrom }).eq("id", r.fromDistId),
      supabase.from("distributors").update({ territory: restoredTo.length ? restoredTo : null }).eq("id", r.toDistId),
    ]);
  }
  await audit("distributor_bulk_transfer_undo", "distributor", r.fromDistId, {
    agents: r.movedAgentIds.length,
    territories: r.movedTerritories.length,
  });
}

/* -------------------------------------------------------------------------- */
/*  Read helpers                                                               */
/* -------------------------------------------------------------------------- */

export interface DistributorLite {
  id: string;
  business_name: string;
  status: string;
  territory: string[] | null;
  parent_id?: string | null;
}

export async function fetchDistributorsLite(): Promise<DistributorLite[]> {
  const { data } = await supabase
    .from("distributors")
    .select("id, business_name, status, territory, parent_id")
    .order("business_name");
  return (data as DistributorLite[]) ?? [];
}
