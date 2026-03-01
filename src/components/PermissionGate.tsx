import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  type PermissionType,
  type PermissionStatus,
  PERMISSION_INFO,
  requestCamera,
  requestContacts,
  requestLocation,
  requestSmsRead,
  getCachedStatus,
} from "@/lib/permissions";

interface PermissionGateProps {
  permission: PermissionType;
  onGranted: (data?: any) => void;
  onDenied?: () => void;
  children: React.ReactNode;
}

const requestMap: Record<PermissionType, () => Promise<{ status: PermissionStatus; data?: any }>> = {
  contacts: requestContacts,
  camera: requestCamera,
  location: requestLocation,
  sms_read: requestSmsRead,
};

export default function PermissionGate({ permission, onGranted, onDenied, children }: PermissionGateProps) {
  const [showSheet, setShowSheet] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const info = PERMISSION_INFO[permission];

  const handleTrigger = useCallback(async () => {
    const cached = getCachedStatus(permission);
    if (cached === "granted") {
      // Already granted — just re-request to get data (e.g. camera stream)
      const result = await requestMap[permission]();
      if (result.status === "granted") {
        onGranted(result.data);
      }
      return;
    }
    setShowSheet(true);
  }, [permission, onGranted]);

  const handleAllow = async () => {
    setRequesting(true);
    const result = await requestMap[permission]();
    setRequesting(false);
    setShowSheet(false);
    if (result.status === "granted") {
      onGranted(result.data);
    } else {
      onDenied?.();
    }
  };

  return (
    <>
      <div onClick={handleTrigger}>{children}</div>

      <AnimatePresence>
        {showSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 flex items-end justify-center"
            onClick={() => setShowSheet(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-5"
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto" />
              
              <div className="text-center space-y-3">
                <div className="text-5xl">{info.icon}</div>
                <h3 className="text-lg font-bold text-foreground">{info.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{info.description}</p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => { setShowSheet(false); onDenied?.(); }}
                >
                  Not Now
                </Button>
                <Button
                  className="flex-1 h-12 font-semibold"
                  onClick={handleAllow}
                  disabled={requesting}
                >
                  {requesting ? "Requesting…" : "Allow"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
