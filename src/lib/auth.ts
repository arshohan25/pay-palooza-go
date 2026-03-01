/**
 * Auth helpers for EasyPay.
 * 
 * Uses Supabase Auth with phone-as-email pattern:
 *   email = "{phone}@easypay.local"
 *   password = PIN + "EP" (padded to meet 6-char minimum)
 *
 * This gives us real server-side auth (bcrypt-hashed PINs, JWT sessions)
 * without requiring an SMS provider.
 */

import { supabase } from "@/integrations/supabase/client";

const EMAIL_DOMAIN = "easypay.local";

/** Convert a BD phone number to an email for Supabase Auth */
export const phoneToEmail = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "").replace(/^(\+?88)/, "");
  return `${cleaned}@${EMAIL_DOMAIN}`;
};

/** Pad PIN to meet Supabase's 6-char minimum password requirement */
export const pinToPassword = (pin: string) => `${pin}EP`;

/** Sign up a new user with phone + PIN */
export async function signUp(phone: string, pin: string, name?: string, referralCode?: string) {
  const email = phoneToEmail(phone);
  const password = pinToPassword(pin);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone,
        display_name: name || phone,
      },
    },
  });

  if (error) throw error;

  // Update profile with name and phone after signup
  if (data.user) {
    await supabase.from("profiles").update({
      name: name || null,
      phone,
    }).eq("user_id", data.user.id);

    // If a referral code was used, create the referral link
    if (referralCode) {
      const { data: referrerProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("referral_code", referralCode)
        .maybeSingle();

      if (referrerProfile && referrerProfile.user_id !== data.user.id) {
        await supabase.from("referrals" as any).insert({
          referrer_id: referrerProfile.user_id,
          referee_id: data.user.id,
          referral_code: referralCode,
        });
      }
    }
  }

  return data;
}

/** Sign in an existing user with phone + PIN */
export async function signIn(phone: string, pin: string) {
  const email = phoneToEmail(phone);
  const password = pinToPassword(pin);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/** Sign out */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Get current session */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Get current user */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Check if a phone number is already registered */
export async function isPhoneRegistered(phone: string): Promise<boolean> {
  // Try signing in with a dummy password — if we get "Invalid login credentials"
  // the user exists. If we get something else, they don't.
  // Alternative: check profiles table
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  
  return !!data;
}

/** Change PIN (password) for authenticated user */
export async function changePin(newPin: string) {
  const { error } = await supabase.auth.updateUser({
    password: pinToPassword(newPin),
  });
  if (error) throw error;
}

/** Get user profile */
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return data;
}

/** Update user profile */
export async function updateProfile(updates: { name?: string; avatar_url?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", user.id);

  if (error) throw error;
}
