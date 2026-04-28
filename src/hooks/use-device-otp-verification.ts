import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";

export type DeviceOtpPortal =
  | "user"
  | "merchant"
  | "agent"
  | "distributor"
  | "super_distributor";

const PURPOSE_BY_PORTAL: Record<DeviceOtpPortal, string> = {
  user: "device_verify_user",
  merchant: "device_verify_merchant",
  agent: "device_verify_agent",
  distributor: "device_verify_distributor",
  super_distributor: "device_verify_super_distributor",
};

const TOKEN_KEY = (phone: string, portal: DeviceOtpPortal) =>
  `mfs_devtok_${portal}_${phone}`;

interface StoredToken { token: string; expires_at: string }

export function getStoredDeviceToken(phone: string, portal: DeviceOtpPortal): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY(phone, portal));
    if (!raw) return null;
    const parsed: StoredToken = JSON.parse(raw);
    if (!parsed?.token) return null;
    if (parsed.expires_at && new Date(parsed.expires_at).getTime() < Date.now()) {
      localStorage.removeItem(TOKEN_KEY(phone, portal));
      return null;
    }
    return parsed.token;
  } catch { return null; }
}

export function storeDeviceToken(
  phone: string, portal: DeviceOtpPortal, token: string, expires_at: string,
) {
  try {
    localStorage.setItem(TOKEN_KEY(phone, portal), JSON.stringify({ token, expires_at }));
  } catch {}
}

export function clearDeviceToken(phone: string, portal: DeviceOtpPortal) {
  try { localStorage.removeItem(TOKEN_KEY(phone, portal)); } catch {}
}

export type DeviceOtpStatus =
  | "idle" | "checking" | "sending" | "awaiting_code"
  | "verifying" | "verified" | "trusted" | "error";

export interface UseDeviceOtpVerificationResult {
  status: DeviceOtpStatus;
  error: string | null;
  resendIn: number;
  devOtp: string | null;
  /** Server-validated trust check using stored token. Returns true if verified by server. */
  checkTrusted: (phone: string) => Promise<boolean>;
  sendOtp: (phone: string) => Promise<void>;
  /** Verifies code → returns one-time otp_ticket on success, or null on failure. */
  verifyOtp: (phone: string, code: string) => Promise<string | null>;
  /** Persists a server-issued device trust token. */
  saveTrustToken: (phone: string, token: string, expires_at: string) => void;
  reset: () => void;
}

const RESEND_SECONDS = 60;

export function useDeviceOtpVerification(
  portal: DeviceOtpPortal,
): UseDeviceOtpVerificationResult {
  const [status, setStatus] = useState<DeviceOtpStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const tickerRef = useRef<number | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    tickerRef.current = window.setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (tickerRef.current) window.clearInterval(tickerRef.current);
    };
  }, [resendIn]);

  const purpose = PURPOSE_BY_PORTAL[portal];

  const reset = useCallback(() => {
    setStatus("idle"); setError(null); setResendIn(0); setDevOtp(null);
  }, []);

  const checkTrusted = useCallback(async (phone: string) => {
    const token = getStoredDeviceToken(phone, portal);
    if (!token) { setStatus("idle"); return false; }
    setStatus("checking");
    setError(null);
    try {
      const device_fp = await getDeviceFingerprint();
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "device-trust-token",
        { body: { phone, device_fp, portal, token } },
      );
      if (invokeErr) throw invokeErr;
      const trusted = !!(data as any)?.trusted;
      if (trusted) {
        setStatus("trusted");
      } else {
        // Stored token rejected — drop it.
        clearDeviceToken(phone, portal);
        setStatus("idle");
      }
      return trusted;
    } catch (err) {
      console.error("checkTrusted failed", err);
      setStatus("idle");
      return false;
    }
  }, [portal]);

  const sendOtp = useCallback(async (phone: string) => {
    setStatus("sending"); setError(null); setDevOtp(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("send-otp", {
        body: { phone, purpose },
      });
      if (invokeErr) throw invokeErr;
      const payload = data as any;
      if (payload?.error) throw new Error(payload.error);
      if (payload?.dev_otp) setDevOtp(String(payload.dev_otp));
      setResendIn(RESEND_SECONDS);
      setStatus("awaiting_code");
    } catch (err: any) {
      setError(err?.message || "Failed to send code");
      setStatus("error");
      throw err;
    }
  }, [purpose]);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    setStatus("verifying"); setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code, purpose },
      });
      if (invokeErr) throw invokeErr;
      const payload = data as any;
      if (!payload?.verified) {
        setError(payload?.error || "Incorrect code");
        setStatus("awaiting_code");
        return null;
      }
      setStatus("verified");
      return (payload?.otp_ticket as string) || null;
    } catch (err: any) {
      setError(err?.message || "Verification failed");
      setStatus("awaiting_code");
      return null;
    }
  }, [purpose]);

  const saveTrustToken = useCallback((phone: string, token: string, expires_at: string) => {
    storeDeviceToken(phone, portal, token, expires_at);
  }, [portal]);

  return {
    status, error, resendIn, devOtp,
    checkTrusted, sendOtp, verifyOtp, saveTrustToken, reset,
  };
}
