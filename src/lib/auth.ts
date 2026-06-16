/**
 * Auth helpers for EasyPay.
 *
 * Uses Supabase Auth with phone-as-email pattern:
 *   email = "{phone}@easypay.app"
 *   password = PIN + "EP" (padded to meet 6-char minimum)
 *
 * This gives us real server-side auth (bcrypt-hashed PINs, JWT sessions)
 * without requiring an SMS provider.
 */

import { supabase } from "@/integrations/supabase/client";

const PRIMARY_EMAIL_DOMAIN = "easypay.app";
const TEAM_PRIMARY_EMAIL_DOMAIN = "team.easypay.app";
const SIGNUP_FALLBACK_EMAIL_DOMAINS = ["example.com"];
const LEGACY_SIGNIN_EMAIL_DOMAINS = ["easypay.local"];
const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

const normalizeBdPhone = (phone: string) =>
  phone.replace(/\D/g, "").replace(/^88/, "");

const buildSyntheticEmail = (localPart: string, domain: string) =>
  `${localPart}@${domain}`;

const unique = <T,>(items: T[]) => [...new Set(items)];

const isInvalidEmailFormatError = (message: string) =>
  message.toLowerCase().includes("unable to validate email address: invalid format");

const getPhoneAuthEmails = (phone: string) => {
  const normalizedPhone = normalizeBdPhone(phone);

  if (!BD_PHONE_REGEX.test(normalizedPhone)) {
    throw new Error("Enter a valid 11-digit Bangladeshi mobile number.");
  }

  const primaryEmail = buildSyntheticEmail(normalizedPhone, PRIMARY_EMAIL_DOMAIN);
  const signupFallbacks = SIGNUP_FALLBACK_EMAIL_DOMAINS.map((domain) =>
    buildSyntheticEmail(normalizedPhone, domain)
  );
  const legacySignInEmails = LEGACY_SIGNIN_EMAIL_DOMAINS.map((domain) =>
    buildSyntheticEmail(normalizedPhone, domain)
  );

  return {
    normalizedPhone,
    primaryEmail,
    signupEmails: unique([primaryEmail, ...signupFallbacks]),
    signinEmails: unique([primaryEmail, ...signupFallbacks, ...legacySignInEmails]),
  };
};

/** Convert a BD phone number to an email for Auth */
export const phoneToEmail = (phone: string) => getPhoneAuthEmails(phone).primaryEmail;

const normalizeTeamUsername = (username: string) =>
  username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");

/** Convert a team username to an email for Auth */
export const usernameToEmail = (username: string) =>
  buildSyntheticEmail(normalizeTeamUsername(username), TEAM_PRIMARY_EMAIL_DOMAIN);

/** Generate a random username like staff-A7K2 */
export function generateUsername(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `staff-${code}`;
}

/** Generate a random 8-char alphanumeric password */
export function generatePassword(): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pw = "";
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

/**
 * Create a phone-based auth account with safe domain fallback.
 * Falls back only when provider rejects email format for the primary synthetic domain.
 */
export async function signUpWithPhonePassword(
  phone: string,
  password: string,
  metadata: Record<string, unknown> = {}
): Promise<{ data: any; normalizedPhone: string; emailUsed: string }> {
  const { normalizedPhone, signupEmails } = getPhoneAuthEmails(phone);
  let lastFormatError: Error | null = null;

  for (const email of signupEmails) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          phone: normalizedPhone,
          ...metadata,
        },
      },
    });

    if (!error) {
      return { data, normalizedPhone, emailUsed: email };
    }

    if (isInvalidEmailFormatError(error.message)) {
      lastFormatError = error;
      continue;
    }

    throw error;
  }

  if (lastFormatError) throw lastFormatError;
  throw new Error("Unable to create account right now.");
}

/** Sign up a new team member with username + password */
export async function teamSignUp(username: string, password: string, displayName: string) {
  const normalizedUsername = normalizeTeamUsername(username);
  if (!normalizedUsername) {
    throw new Error("Username can only include letters, numbers, dots, underscores, and hyphens.");
  }

  const email = usernameToEmail(normalizedUsername);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        is_team_member: true,
      },
    },
  });

  if (error) throw error;
  return data;
}

/** Sign in a team member with username + password */
export async function teamSignIn(username: string, password: string) {
  const normalizedUsername = normalizeTeamUsername(username);
  if (!normalizedUsername) {
    throw new Error("Invalid username format.");
  }

  const email = usernameToEmail(normalizedUsername);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/** Pad PIN to meet Supabase's 6-char minimum password requirement */
export const pinToPassword = (pin: string) => `${pin}EP`;

/** Sign up a new user with phone + PIN */
export async function signUp(phone: string, pin: string, name?: string, referralCode?: string) {
  const password = pinToPassword(pin);
  const displayName = name?.trim() || normalizeBdPhone(phone);

  const { data, normalizedPhone } = await signUpWithPhonePassword(phone, password, {
    display_name: displayName,
  });

  // Update profile with name and phone after signup
  if (data.user) {
    await supabase
      .from("profiles")
      .update({
        name: name || null,
        phone: normalizedPhone,
      })
      .eq("user_id", data.user.id);

    // If a referral code was used, validate and create the referral link
    if (referralCode) {
      // Validate format
      if (!/^EZP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(referralCode)) {
        console.warn("Invalid referral code format:", referralCode);
      } else {
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
  }

  return data;
}

/** Sign in an existing user with phone + PIN */
export async function signIn(phone: string, pin: string) {
  const { signinEmails } = getPhoneAuthEmails(phone);
  const password = pinToPassword(pin);
  let lastCredentialError: Error | null = null;

  for (const email of signinEmails) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
      try {
        const { activityTracker } = await import("@/lib/activityTracker");
        activityTracker.auth("login", { method: "phone_pin" });
      } catch {}
      return data;
    }

    if (error.message.includes("Invalid login credentials")) {
      lastCredentialError = error;
      continue;
    }

    throw error;
  }

  if (lastCredentialError) {
    try {
      const { activityTracker } = await import("@/lib/activityTracker");
      activityTracker.auth("pin_failed", { method: "phone_pin" });
    } catch {}
    throw lastCredentialError;
  }
  throw new Error("Unable to sign in right now.");
}

/** Sign out */
export async function signOut() {
  try {
    const { activityTracker } = await import("@/lib/activityTracker");
    activityTracker.auth("logout");
  } catch {}
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}


/** Get current session */
export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/** Get current user */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Check if a phone number is already registered */
export async function isPhoneRegistered(phone: string): Promise<boolean> {
  const normalizedPhone = normalizeBdPhone(phone);
  if (!BD_PHONE_REGEX.test(normalizedPhone)) return false;

  const { data, error } = await supabase.rpc("is_phone_registered", {
    p_phone: normalizedPhone,
  });

  if (error) throw error;
  return data === true;
}

/** Change PIN (password) for authenticated user */
export async function changePin(newPin: string) {
  const { error } = await supabase.auth.updateUser({
    password: pinToPassword(newPin),
  });
  if (error) throw error;

  // Log PIN change history
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.functions.invoke("log-pin-change", {
      body: { change_type: "self_change", method: "manual" },
    });
  }
}

/** Get user profile */
export async function getProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

  return data;
}

/** Update user profile */
export async function updateProfile(updates: { name?: string; avatar_url?: string }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);

  if (error) throw error;
}
