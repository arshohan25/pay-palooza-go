import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export type KycStatus = "none" | "pending" | "verified" | "rejected";

interface KycState {
  status: KycStatus;
  rejectionReason: string | null;
}

const EMPTY_KYC_STATE: KycState = {
  status: "none",
  rejectionReason: null,
};

let kycChannel: ReturnType<typeof supabase.channel> | null = null;
let kycChannelUserId: string | null = null;
let kycSubscribers = 0;
let notificationPermissionRequested = false;
let lastHandledTransitionKey: string | null = null;

const playKycChime = (type: "success" | "error") => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (type === "success") {
      const notes = [660, 880, 1100];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.13);
        osc.start(ctx.currentTime + index * 0.13);
        osc.stop(ctx.currentTime + index * 0.13 + 0.12);
      });
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    } else {
      const notes = [440, 330];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.15);
        osc.start(ctx.currentTime + index * 0.15);
        osc.stop(ctx.currentTime + index * 0.15 + 0.14);
      });
      gain.gain.setValueAtTime(0.13, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    }
  } catch {
    // Web Audio not available
  }
};

const fireBrowserNotification = (title: string, body: string) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: `kyc-status-${Date.now()}`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Notifications not available
  }
};

async function fetchKycState(userId?: string): Promise<KycState> {
  if (!userId) return EMPTY_KYC_STATE;

  const [profileResult, kycResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("kyc_exempt")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("kyc_verifications")
      .select("status, reviewer_notes")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.data?.kyc_exempt) {
    return { status: "verified", rejectionReason: null };
  }

  const data = kycResult.data;
  if (!data) return EMPTY_KYC_STATE;

  const status = data.status as string;
  if (status === "verified" || status === "pending" || status === "rejected") {
    return {
      status,
      rejectionReason: status === "rejected" ? data.reviewer_notes || null : null,
    };
  }

  return { status: "pending", rejectionReason: null };
}

export function useKycStatus() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const prevStatusRef = useRef<KycStatus | null>(null);

  const query = useQuery({
    queryKey: ["kyc-status", user?.id],
    queryFn: () => fetchKycState(user?.id),
    enabled: !authLoading,
    staleTime: 30_000,
  });

  const status = query.data?.status ?? "none";
  const rejectionReason = query.data?.rejectionReason ?? null;

  useEffect(() => {
    if (
      notificationPermissionRequested ||
      !("Notification" in window) ||
      Notification.permission !== "default"
    ) {
      return;
    }

    notificationPermissionRequested = true;
    Notification.requestPermission().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) {
      prevStatusRef.current = null;
      return;
    }

    const previousStatus = prevStatusRef.current;
    if (previousStatus === "pending" && (status === "verified" || status === "rejected")) {
      const transitionKey = `${user.id}:${previousStatus}->${status}:${rejectionReason ?? ""}`;

      if (lastHandledTransitionKey !== transitionKey) {
        lastHandledTransitionKey = transitionKey;

        if (status === "verified") {
          playKycChime("success");
          import("@/lib/confetti").then((module) => module.fireSuccessConfetti());
          import("@/lib/haptics").then((module) => module.haptics.success());
          toast.success("Your identity has been verified! All features are now unlocked. 🎉");
          fireBrowserNotification(
            "KYC Approved ✅",
            "Your identity has been verified! All features are now unlocked."
          );
        } else {
          const reason = rejectionReason || "Please resubmit with correct documents.";
          playKycChime("error");
          import("@/lib/haptics").then((module) => module.haptics.error());
          toast.error("KYC Verification Rejected", {
            description: reason,
            duration: 8000,
          });
          fireBrowserNotification("KYC Rejected ❌", reason);
        }
      }
    }

    if (status !== "none" || previousStatus !== null) {
      prevStatusRef.current = status;
    }
  }, [rejectionReason, status, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    kycSubscribers += 1;

    if (!kycChannel || kycChannelUserId !== user.id) {
      if (kycChannel) {
        supabase.removeChannel(kycChannel);
      }

      kycChannelUserId = user.id;
      kycChannel = supabase
        .channel(`kyc-status-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "kyc_verifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["kyc-status", user.id] });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload.old?.kyc_exempt !== payload.new?.kyc_exempt) {
              queryClient.invalidateQueries({ queryKey: ["kyc-status", user.id] });
            }
          }
        )
        .subscribe();
    }

    return () => {
      kycSubscribers -= 1;
      if (kycSubscribers <= 0 && kycChannel) {
        supabase.removeChannel(kycChannel);
        kycChannel = null;
        kycChannelUserId = null;
      }
    };
  }, [queryClient, user?.id]);

  return {
    status,
    loading: authLoading || query.isLoading,
    rejectionReason,
    refetch: () => query.refetch(),
  };
}
