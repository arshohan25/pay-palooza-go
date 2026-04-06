import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";

type AppRole = Database["public"]["Enums"]["app_role"];

async function fetchUserRoles(userId?: string) {
  if (!userId) return [] as AppRole[];

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  return (data?.map((row) => row.role) ?? []) as AppRole[];
}

export function useUserRoles() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: () => fetchUserRoles(user?.id),
    enabled: !!user && !authLoading,
    staleTime: 60_000,
  });

  return {
    roles: query.data ?? [],
    loading: authLoading || (!!user && query.isLoading),
  };
}
