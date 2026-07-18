import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { verifyPin } from "@/lib/verifyPin";
import { haptics } from "@/lib/haptics";

interface PinConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onConfirmed: () => Promise<void> | void;
}

/**
 * Reusable PIN gate for any transaction flow that currently
 * commits a debit without re-verifying the user's PIN.
 */
export default function PinConfirmSheet({
  open,
  onClose,
  title,
  description,
  onConfirmed,
}: PinConfirmSheetProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setPin("");
      setError("");
      setBusy(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (pin.length < 4) {
      setError("Enter your 4-digit PIN.");
      return;
    }
    setBusy(true);
    const ok = await verifyPin(pin);
    if (!ok) {
      setError("Incorrect PIN. Please try again.");
      setPin("");
      setBusy(false);
      haptics.error();
      return;
    }
    try {
      await onConfirmed();
      haptics.success();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Transaction failed.");
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <SheetContent side="bottom" className="rounded-t-[19px] p-5 space-y-4">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {title}
          </SheetTitle>
        </SheetHeader>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Enter your PIN
          </label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            placeholder="••••"
            className="text-center text-lg tracking-[0.5em] rounded-xl h-12 mt-1"
          />
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>
        <Button
          onClick={handleConfirm}
          disabled={pin.length < 4 || busy}
          className="w-full rounded-xl h-12 font-semibold"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Verifying…
            </>
          ) : (
            "Confirm"
          )}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
