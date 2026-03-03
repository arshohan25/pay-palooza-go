import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
  name: string | null;
  phone: string;
}

/**
 * Fetches the authenticated user's profile (name, phone) from the database.
 * Listens for "profile-updated" CustomEvent for instant optimistic updates.
 */
export function useProfile() {
  const [profile, setProfile] = useState<ProfileData>({
    name: localStorage.getItem("mfs_user_name"),
    phone: localStorage.getItem("mfs_registered_phone") || "",
  });
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("name, phone")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setProfile({ name: data.name, phone: data.phone });
      if (data.name) localStorage.setItem("mfs_user_name", data.name);
      if (data.phone) localStorage.setItem("mfs_registered_phone", data.phone);
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
