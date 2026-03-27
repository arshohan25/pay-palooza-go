import { supabase } from "@/integrations/supabase/client";

export type PermissionType = "contacts" | "camera" | "location" | "sms_read";
export type PermissionStatus = "granted" | "denied" | "prompt" | "unsupported";

interface PermissionResult {
  permission: PermissionType;
  status: PermissionStatus;
  data?: any;
}

const CACHE_KEY = "ezypay_permissions";

function getCachedPermissions(): Record<string, PermissionStatus> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setCachedPermission(perm: PermissionType, status: PermissionStatus) {
  const cache = getCachedPermissions();
  cache[perm] = status;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function getCachedStatus(perm: PermissionType): PermissionStatus {
  return getCachedPermissions()[perm] || "prompt";
}

async function persistPermission(permission: PermissionType, status: PermissionStatus) {
  setCachedPermission(permission, status);
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const deviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
  };

  await supabase.from("user_permissions" as any).upsert({
    user_id: session.user.id,
    permission,
    status,
    device_info: deviceInfo,
    granted_at: status === "granted" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  } as any, { onConflict: "user_id,permission" });
}

// ── Contact Picker API ──
export async function requestContacts(): Promise<PermissionResult> {
  const nav = navigator as any;
  if (!("contacts" in nav) || !nav.contacts?.select) {
    await persistPermission("contacts", "unsupported");
    return { permission: "contacts", status: "unsupported" };
  }

  try {
    const contacts = await nav.contacts.select(["name", "tel"], { multiple: true });
    await persistPermission("contacts", "granted");
    return { permission: "contacts", status: "granted", data: contacts };
  } catch (err: any) {
    const status: PermissionStatus = err.name === "NotAllowedError" ? "denied" : "prompt";
    await persistPermission("contacts", status);
    return { permission: "contacts", status };
  }
}

// ── Camera (getUserMedia) ──
export async function requestCamera(): Promise<PermissionResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    await persistPermission("camera", "unsupported");
    return { permission: "camera", status: "unsupported" };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    // Don't stop the stream here — caller will use it
    await persistPermission("camera", "granted");
    return { permission: "camera", status: "granted", data: stream };
  } catch (err: any) {
    const status: PermissionStatus = err.name === "NotAllowedError" ? "denied" : "prompt";
    await persistPermission("camera", status);
    return { permission: "camera", status };
  }
}

// ── Location (Geolocation API) ──
export async function requestLocation(): Promise<PermissionResult> {
  if (!navigator.geolocation) {
    await persistPermission("location", "unsupported");
    return { permission: "location", status: "unsupported" };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await persistPermission("location", "granted");
        resolve({
          permission: "location",
          status: "granted",
          data: { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy },
        });
      },
      async (err) => {
        const status: PermissionStatus = err.code === err.PERMISSION_DENIED ? "denied" : "prompt";
        await persistPermission("location", status);
        resolve({ permission: "location", status });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ── SMS / OTP Auto-Read (Web OTP API) ──
export async function requestSmsRead(): Promise<PermissionResult> {
  if (!("OTPCredential" in window)) {
    await persistPermission("sms_read", "unsupported");
    return { permission: "sms_read", status: "unsupported" };
  }

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 60000);
    const cred = await (navigator.credentials as any).get({
      otp: { transport: ["sms"] },
      signal: ac.signal,
    });
    clearTimeout(timeout);
    await persistPermission("sms_read", "granted");
    return { permission: "sms_read", status: "granted", data: cred?.code };
  } catch (err: any) {
    const status: PermissionStatus = err.name === "NotAllowedError" ? "denied" : "prompt";
    await persistPermission("sms_read", status);
    return { permission: "sms_read", status };
  }
}

// ── Check permission status via Permissions API ──
export async function checkPermissionStatus(perm: PermissionType): Promise<PermissionStatus> {
  const permMap: Record<string, string> = {
    camera: "camera",
    location: "geolocation",
  };

  const browserPerm = permMap[perm];
  if (!browserPerm || !navigator.permissions?.query) {
    return getCachedStatus(perm);
  }

  try {
    const result = await navigator.permissions.query({ name: browserPerm as PermissionName });
    return result.state as PermissionStatus;
  } catch {
    return getCachedStatus(perm);
  }
}

export const PERMISSION_INFO: Record<PermissionType, { title: string; description: string; icon: string }> = {
  contacts: {
    title: "Access Contacts",
    description: "Pick a recipient directly from your phone contacts for faster transfers.",
    icon: "👥",
  },
  camera: {
    title: "Camera Access",
    description: "Scan QR codes to quickly send money or make payments.",
    icon: "📸",
  },
  location: {
    title: "Location Access",
    description: "Your location helps us detect fraudulent activity and keep your account safe.",
    icon: "📍",
  },
  sms_read: {
    title: "Read SMS/OTP",
    description: "Automatically read verification codes from SMS for faster sign-in.",
    icon: "💬",
  },
};
