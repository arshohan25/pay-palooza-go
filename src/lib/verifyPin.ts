/**
 * Verify the user's 4-digit PIN by calling the auth API directly via fetch.
 * This avoids using supabase.auth.signInWithPassword which would replace
 * the current session and trigger onAuthStateChange, causing flow components
 * to remount and lose their step state.
 */
import { supabase } from "@/integrations/supabase/client";
import { pinToPassword } from "@/lib/auth";

export async function verifyPin(pin: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          email: user.email,
          password: pinToPassword(pin),
        }),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
