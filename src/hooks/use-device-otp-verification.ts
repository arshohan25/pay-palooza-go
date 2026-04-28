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

const TRUST_KEY = (phone: string, portal: DeviceOtpPortal) =>
  `mfs_trusted_${portal}_${phone}`;

export type DeviceOtpStatus =
  | "idle"
  | "checking"
  | "sending"
  | "awaiting_code"
  | "verifying"
  | "verified"
  | "trusted"
  | "error";

export interface UseDeviceOtpVerificationResult {
  status: DeviceOtpStatus;
  error: string | null;
  resendIn: number;
  devOtp: string | null;
  /** Returns true if the device is already trusted for (phone, portal). */
  checkTrusted: (phone: string) => Promise<boolean>;
  /** Sends a fresh OTP for (phone, portal). */
  sendOtp: (phone: string) => Promise<void>;
  /** Verifies the entered code; on success, status → "verified". */
  verifyOtp: (phone: string, code: string) => Promise<boolean>;
  /** Marks the device as trusted (call after backend session is established). */
  markTrusted: (phone: string) => Promise<void>;
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
    setStatus("idle");
    setError(null);
    setResendIn(0);
    setDevOtp(null);
  }, []);

  const checkTrusted = useCallback(
    async (phone: string) => {
      // Local fast-path: if we previously trusted this device for this phone+portal,
      // skip the round-trip. Server is source of truth for fresh devices.
      try {
        const local = localStorage.getItem(TRUST_KEY(phone, portal));
        if (local === "1") {
          setStatus("trusted");
          return true;
        }
      } catch {}

      setStatus("checking");
      setError(null);
      try {
        const device_fp = await getDeviceFingerprint();
        const { data, error: invokeErr } = await supabase.functions.invoke(
          "check-trusted-device",
          { body: { phone, device_fp, portal } },
        );
        if (invokeErr) throw invokeErr;
        const trusted = !!(data as any)?.trusted;
        if (trusted) {
          try { localStorage.setItem(TRUST_KEY(phone, portal), "1"); } catch {}
          setStatus("trusted");
        } else {
          setStatus("idle");
        }
        return trusted;
      } catch (err: any) {
        console.error("checkTrusted failed", err);
        // Fail-closed but don't block: treat as untrusted so OTP path runs.
        setStatus("idle");
        return false;
      }
    },
    [portal],
  );

  const sendOtp = useCallback(
    async (phone: string) => {
      setStatus("sending");
      setError(null);
      setDevOtp(null);
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
    },
    [purpose],
  );

  const verifyOtp = useCallback(
    async (phone: string, code: string) => {
      setStatus("verifying");
      setError(null);
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke("verify-otp", {
          body: { phone, code, purpose },
        });
        if (invokeErr) throw invokeErr;
        const payload = data as any;
        if (!payload?.verified) {
          setError(payload?.error || "Incorrect code");
          setStatus("awaiting_code");
          return false;
        }
        setStatus("verified");
        return true;
      } catch (err: any) {
        setError(err?.message || "Verification failed");
        setStatus("awaiting_code");
        return false;
      }
    },
    [purpose],
  );

  const markTrusted = useCallback(
    async (phone: string) => {
      try {
        const device_fp = await getDeviceFingerprint();
        await supabase.functions.invoke("mark-trusted-device", {
          body: { phone, device_fp, portal },
        });
        try { localStorage.setItem(TRUST_KEY(phone, portal), "1"); } catch {}
      } catch (err) {
        // Non-fatal — user is already authenticated; we'll re-prompt next time.
        console.warn("markTrusted failed", err);
      }
    },
    [portal],
  );

  return {
    status,
    error,
    resendIn,
    devOtp,
    checkTrusted,
    sendOtp,
    verifyOtp,
    markTrusted,
    reset,
  };
}
