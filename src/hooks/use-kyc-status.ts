import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { toast } from "sonner";

export type KycStatus = "none" | "pending" | "verified" | "rejected";

/** Synthesized chime via Web Audio API — no external files needed */
const playKycChime = (type: "success" | "error") => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (type === "success") {
      // Ascending 3-note celebratory chime
      const notes = [660, 880, 1100];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.13);
        osc.start(ctx.currentTime + i * 0.13);
        osc.stop(ctx.currentTime + i * 0.13 + 0.12);
      });
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    } else {
      // Descending 2-note gentle alert
      const notes = [440, 330];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.14);
      });
      gain.gain.setValueAtTime(0.13, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    }
  } catch { /* Web Audio not available */ }
};

const fireBrowserNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: "kyc-status-" + Date.now(),
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* not available */ }
};

export function useKycStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<KycStatus>("none");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const prevStatusRef = useRef<KycStatus | null>(null);

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setStatus("none");
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("kyc_verifications")
      .select("status, reviewer_notes")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const s = data.status as string;
      if (s === "verified" || s === "pending" || s === "rejected") {
        setStatus(s);
        if (s === "rejected") {
          setRejectionReason(data.reviewer_notes || null);
        } else {
          setRejectionReason(null);
        }
      } else {
        setStatus("pending");
        setRejectionReason(null);
      }
    } else {
      setStatus("none");
      setRejectionReason(null);
    }
    setLoading(false);
  }, [user]);

  // Detect pending → verified / rejected transitions
  useEffect(() => {
    if (prevStatusRef.current === "pending" && status === "verified") {
      playKycChime("success");
      fireSuccessConfetti();
      haptics.success();
      toast.success("Your identity has been verified! All features are now unlocked. 🎉");
      fireBrowserNotification("KYC Approved ✅", "Your identity has been verified! All features are now unlocked.");
    }
    if (prevStatusRef.current === "pending" && status === "rejected") {
      playKycChime("error");
      haptics.error();
      const reason = rejectionReason || "Please resubmit with correct documents.";
      toast.error("KYC Verification Rejected", { description: reason, duration: 8000 });
      fireBrowserNotification("KYC Rejected ❌", reason);
    }
    if (status !== "none" || prevStatusRef.current !== null) {
      prevStatusRef.current = status;
    }
  }, [status, rejectionReason]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime: listen for KYC status changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("kyc-status-" + user.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "kyc_verifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchStatus();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchStatus]);

  return { status, loading, rejectionReason, refetch: fetchStatus };
}
