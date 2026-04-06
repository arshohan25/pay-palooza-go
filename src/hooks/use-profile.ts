import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface ProfileData {
  name: string | null;
  phone: string;
  avatar_url: string | null;
}

const EMPTY_PROFILE: ProfileData = {
  name: null,
  phone: "",
  avatar_url: null,
};

let profileChannel: ReturnType<typeof supabase.channel> | null = null;
let profileChannelUserId: string | null = null;
let profileSubscribers = 0;

function readStoredProfile(): ProfileData {
  return {
    name: localStorage.getItem("mfs_user_name") || null,
    phone: localStorage.getItem("mfs_registered_phone") || "",
    avatar_url: localStorage.getItem("mfs_display_photo") || null,
  };
}

function clearStoredProfile() {
  localStorage.removeItem("mfs_user_name");
  localStorage.removeItem("mfs_registered_phone");
  localStorage.removeItem("mfs_display_photo");
  localStorage.removeItem("mfs_cached_user_id");
}

function syncStoredProfile(userId: string, profile: ProfileData) {
  localStorage.setItem("mfs_cached_user_id", userId);

  if (profile.name) {
    localStorage.setItem("mfs_user_name", profile.name);
  } else {
    localStorage.removeItem("mfs_user_name");
  }

  if (profile.phone) {
    localStorage.setItem("mfs_registered_phone", profile.phone);
  } else {
    localStorage.removeItem("mfs_registered_phone");
  }

  if (profile.avatar_url) {
    localStorage.setItem("mfs_display_photo", profile.avatar_url);
  } else {
    localStorage.removeItem("mfs_display_photo");
  }
}

async function fetchProfile(userId?: string): Promise<ProfileData> {
  if (!userId) return EMPTY_PROFILE;

  const cachedUserId = localStorage.getItem("mfs_cached_user_id");
  if (cachedUserId && cachedUserId !== userId) {
    clearStoredProfile();
  }

  const { data } = await supabase
    .from("profiles")
    .select("name, phone, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return EMPTY_PROFILE;

  return {
    name: data.name,
    phone: data.phone ?? "",
    avatar_url: data.avatar_url,
  };
}

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user?.id),
    enabled: !!user && !authLoading,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user && !authLoading) {
      clearStoredProfile();
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (user?.id && query.data) {
      syncStoredProfile(user.id, query.data);
    }
  }, [query.data, user?.id]);

  useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      if (!user?.id) return;
      const detail = (event as CustomEvent).detail ?? {};

      queryClient.setQueryData<ProfileData>(["profile", user.id], (previous) => ({
        ...(previous ?? readStoredProfile()),
        ...(detail?.name !== undefined ? { name: detail.name } : {}),
        ...(detail?.phone !== undefined ? { phone: detail.phone } : {}),
        ...(detail?.avatar_url !== undefined ? { avatar_url: detail.avatar_url } : {}),
      }));

      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    };

    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    profileSubscribers += 1;

    if (!profileChannel || profileChannelUserId !== user.id) {
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
      }

      profileChannelUserId = user.id;
      profileChannel = supabase
        .channel(`profile-realtime-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
          }
        )
        .subscribe();
    }

    return () => {
      profileSubscribers -= 1;
      if (profileSubscribers <= 0 && profileChannel) {
        supabase.removeChannel(profileChannel);
        profileChannel = null;
        profileChannelUserId = null;
      }
    };
  }, [queryClient, user?.id]);

  const profile = user ? query.data ?? readStoredProfile() : EMPTY_PROFILE;

  const displayName = profile.name
    ? profile.name
    : profile.phone && profile.phone !== ""
      ? `+88 ${profile.phone.slice(0, 3)}****${profile.phone.slice(-3)}`
      : "My Wallet";

  return {
    ...profile,
    displayName,
    loading: authLoading || (!!user && query.isLoading),
  };
}
