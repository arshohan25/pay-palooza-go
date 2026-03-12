import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AvailableAgent {
  user_id: string;
  display_name: string;
  open_count: number;
}

export function useAgentRouting() {
  const [routing, setRouting] = useState(false);

  const getAvailableAgents = useCallback(async (): Promise<AvailableAgent[]> => {
    const { data: agents } = await supabase
      .from("team_members")
      .select("user_id, display_name")
      .eq("department", "support")
      .eq("is_available", true);

    if (!agents || agents.length === 0) return [];

    const { data: convs } = await supabase
      .from("support_conversations")
      .select("assigned_agent_id")
      .eq("status", "open")
      .not("assigned_agent_id", "is", null);

    const counts: Record<string, number> = {};
    (convs ?? []).forEach((c: any) => {
      if (c.assigned_agent_id) counts[c.assigned_agent_id] = (counts[c.assigned_agent_id] || 0) + 1;
    });

    return agents.map(a => ({
      user_id: a.user_id,
      display_name: a.display_name,
      open_count: counts[a.user_id] || 0,
    })).sort((a, b) => a.open_count - b.open_count);
  }, []);

  const getLeastBusyAgent = useCallback(async (): Promise<AvailableAgent | null> => {
    const agents = await getAvailableAgents();
    return agents.length > 0 ? agents[0] : null;
  }, [getAvailableAgents]);

  const assignConversation = useCallback(async (conversationId: string, agentUserId?: string) => {
    setRouting(true);
    try {
      let targetAgent = agentUserId;
      let agentName = "";

      if (!targetAgent) {
        const best = await getLeastBusyAgent();
        if (!best) {
          toast.error("No available support agents online");
          setRouting(false);
          return false;
        }
        targetAgent = best.user_id;
        agentName = best.display_name;
      }

      const { error } = await supabase
        .from("support_conversations")
        .update({ assigned_agent_id: targetAgent } as any)
        .eq("id", conversationId);

      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("audit_logs").insert({
          actor_id: session.user.id,
          action: "support_conversation_assigned",
          entity_type: "support_conversation",
          entity_id: conversationId,
          details: { assigned_to: targetAgent, agent_name: agentName },
        });
      }

      toast.success(agentName ? `Assigned to ${agentName}` : "Conversation assigned");
      setRouting(false);
      return true;
    } catch (e: any) {
      toast.error(e.message || "Failed to assign");
      setRouting(false);
      return false;
    }
  }, [getLeastBusyAgent]);

  /** Auto-assign a new conversation to the least-busy agent (silent, no toast on failure) */
  const autoAssignNewConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    try {
      const best = await getLeastBusyAgent();
      if (!best) return false;

      const { error } = await supabase
        .from("support_conversations")
        .update({ assigned_agent_id: best.user_id } as any)
        .eq("id", conversationId);

      if (error) return false;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("audit_logs").insert({
          actor_id: session.user.id,
          action: "support_conversation_auto_assigned",
          entity_type: "support_conversation",
          entity_id: conversationId,
          details: { assigned_to: best.user_id, agent_name: best.display_name },
        });
      }

      return true;
    } catch {
      return false;
    }
  }, [getLeastBusyAgent]);

  return { routing, getAvailableAgents, getLeastBusyAgent, assignConversation, autoAssignNewConversation };
}
