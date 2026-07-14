import { supabase } from "@/integrations/supabase/client";

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

/** Assign / re-assign / unassign a single agent to a distributor. Pass null to unlink. */
export async function reassignAgent(
  agentId: string,
  fromDistId: string | null,
  toDistId: string | null,
) {
  if (fromDistId === toDistId) return;
  const { error } = await supabase
    .from("agents")
    .update({ distributor_id: toDistId })
    .eq("id", agentId);
  if (error) throw error;
  const action = !fromDistId ? "agent_assigned" : !toDistId ? "agent_unassigned" : "agent_transferred";
  await audit(action, "agent", agentId, { from: fromDistId, to: toDistId });
}

/** Bulk assign a set of agents to a single distributor. */
export async function bulkAssignAgents(agentIds: string[], toDistId: string | null) {
  if (agentIds.length === 0) return { succeeded: 0, failed: 0 };
  const { error } = await supabase
    .from("agents")
    .update({ distributor_id: toDistId })
    .in("id", agentIds);
  if (error) return { succeeded: 0, failed: agentIds.length };
  await audit(
    toDistId ? "agents_bulk_assigned" : "agents_bulk_unassigned",
    "agent",
    "bulk",
    { count: agentIds.length, to: toDistId, agent_ids: agentIds },
  );
  return { succeeded: agentIds.length, failed: 0 };
}

/** Move a territory code from one distributor to another (deduped on target). */
export async function transferTerritory(
  code: string,
  fromDistId: string,
  toDistId: string,
) {
  if (fromDistId === toDistId) return;
  const [{ data: from }, { data: to }] = await Promise.all([
    supabase.from("distributors").select("territory").eq("id", fromDistId).maybeSingle(),
    supabase.from("distributors").select("territory").eq("id", toDistId).maybeSingle(),
  ]);
  const fromT: string[] = (from?.territory ?? []) as string[];
  const toT: string[] = (to?.territory ?? []) as string[];
  const nextFrom = fromT.filter((c) => c !== code);
  const nextTo = toT.includes(code) ? toT : [...toT, code];
  const [r1, r2] = await Promise.all([
    supabase.from("distributors").update({ territory: nextFrom.length ? nextFrom : null }).eq("id", fromDistId),
    supabase.from("distributors").update({ territory: nextTo }).eq("id", toDistId),
  ]);
  if (r1.error || r2.error) throw (r1.error || r2.error);
  await audit("territory_transferred", "distributor", toDistId, { code, from: fromDistId, to: toDistId });
}

/** Remove a territory code from a distributor. */
export async function removeTerritory(code: string, distId: string) {
  const { data } = await supabase.from("distributors").select("territory").eq("id", distId).maybeSingle();
  const t: string[] = (data?.territory ?? []) as string[];
  const next = t.filter((c) => c !== code);
  const { error } = await supabase
    .from("distributors")
    .update({ territory: next.length ? next : null })
    .eq("id", distId);
  if (error) throw error;
  await audit("territory_removed", "distributor", distId, { code });
}

/** Move ALL agents and/or territories from one distributor to another. */
export async function bulkTransferDistributor(
  fromDistId: string,
  toDistId: string,
  opts: { agents: boolean; territories: boolean },
) {
  if (fromDistId === toDistId) throw new Error("Source and target must differ");
  let agentCount = 0;
  let territoryCount = 0;

  if (opts.agents) {
    const { data: agents } = await supabase
      .from("agents").select("id").eq("distributor_id", fromDistId);
    const ids = (agents ?? []).map((a: any) => a.id);
    if (ids.length > 0) {
      const { error } = await supabase
        .from("agents").update({ distributor_id: toDistId }).in("id", ids);
      if (error) throw error;
      agentCount = ids.length;
    }
  }

  if (opts.territories) {
    const [{ data: from }, { data: to }] = await Promise.all([
      supabase.from("distributors").select("territory").eq("id", fromDistId).maybeSingle(),
      supabase.from("distributors").select("territory").eq("id", toDistId).maybeSingle(),
    ]);
    const fromT: string[] = (from?.territory ?? []) as string[];
    const toT: string[] = (to?.territory ?? []) as string[];
    if (fromT.length > 0) {
      const merged = Array.from(new Set([...toT, ...fromT]));
      const [r1, r2] = await Promise.all([
        supabase.from("distributors").update({ territory: null }).eq("id", fromDistId),
        supabase.from("distributors").update({ territory: merged }).eq("id", toDistId),
      ]);
      if (r1.error || r2.error) throw (r1.error || r2.error);
      territoryCount = fromT.length;
    }
  }

  await audit("distributor_bulk_transferred", "distributor", toDistId, {
    from: fromDistId,
    to: toDistId,
    agents: agentCount,
    territories: territoryCount,
  });
  return { agentCount, territoryCount };
}

export interface DistributorLite {
  id: string;
  business_name: string;
  status: string;
  territory: string[] | null;
}

export async function fetchDistributorsLite(): Promise<DistributorLite[]> {
  const { data } = await supabase
    .from("distributors")
    .select("id, business_name, status, territory")
    .order("business_name");
  return (data as DistributorLite[]) ?? [];
}
