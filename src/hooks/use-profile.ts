import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
  name: string | null;
  phone: string;
  avatar_url: string | null;
}

/**
 * Fetches the authenticated user's profile (name, phone) from the database.
 * Listens for "profile-updated" CustomEvent for instant optimistic updates.
 */
export function useProfile() {
  const [profile, setProfile] = useState<ProfileData>({
    name: localStorage.getItem("mfs_user_name"),
    phone: localStorage.getItem("mfs_registered_phone") || "",
    avatar_url: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("name, phone, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setProfile({ name: data.name, phone: data.phone, avatar_url: data.avatar_url });
      // Always sync DB values to localStorage to prevent stale data
      if (data.name) {
        localStorage.setItem("mfs_user_name", data.name);
      } else {
        localStorage.removeItem("mfs_user_name");
      }
      if (data.phone) localStorage.setItem("mfs_registered_phone", data.phone);
      if (data.avatar_url) {
        localStorage.setItem("mfs_display_photo", data.avatar_url);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();

    // Instant optimistic update when ProfileEditFlow saves
    const handleProfileUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.name) {
        setProfile((prev) => ({ ...prev, name: detail.name }));
        localStorage.setItem("mfs_user_name", detail.name);
      }
      // Also re-fetch from DB to stay in sync
      fetchProfile();
    };

    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, [fetchProfile]);

  const displayName = profile.name
    ? profile.name
    : profile.phone && profile.phone !== ""
      ? `+88 ${profile.phone.slice(0, 3)}****${profile.phone.slice(-3)}`
      : "My Wallet";

  return { ...profile, displayName, loading };
}
