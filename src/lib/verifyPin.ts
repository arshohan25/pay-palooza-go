/**
 * Verify the user's 4-digit PIN by re-authenticating against Supabase Auth.
 * Returns true if PIN is correct, false otherwise.
 */
import { supabase } from "@/integrations/supabase/client";
import { pinToPassword } from "@/lib/auth";

export async function verifyPin(pin: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: pinToPassword(pin),
  });

  return !error;
}
