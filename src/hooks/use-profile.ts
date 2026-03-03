import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
  name: string | null;
  phone: string;
}

/**
 * Fetches the authenticated user's profile (name, phone) from the database.
 * Falls back to localStorage values if not authenticated or fetch fails.
 */
export function useProfile() {
  const [profile, setProfile] = useState<ProfileData>({
    name: localStorage.getItem("mfs_user_name"),
    phone: localStorage.getItem("mfs_registered_phone") || "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const { data } = await supabase
        .from("profiles")
        .select("name, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data && !cancelled) {
        setProfile({ name: data.name, phone: data.phone });
        // Sync to localStorage for offline/quick access
        if (data.name) localStorage.setItem("mfs_user_name", data.name);
        if (data.phone) localStorage.setItem("mfs_registered_phone", data.phone);
      }
      if (!cancelled) setLoading(false);
    };

    fetchProfile();

    // Re-fetch when profile is updated from ProfileEditFlow
    const handleProfileUpdate = () => { fetchProfile(); };
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, []);

  const displayName = profile.name
    ? profile.name
    : profile.phone && profile.phone !== ""
      ? `+880 ${profile.phone.slice(0, 3)}****${profile.phone.slice(-3)}`
      : "My Wallet";

  return { ...profile, displayName, loading };
}
