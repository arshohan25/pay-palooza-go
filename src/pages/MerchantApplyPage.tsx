import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MerchantApplicationFlow from "@/components/MerchantApplicationFlow";
import { Loader2 } from "lucide-react";

/**
 * Dedicated route (/merchant/apply) that opens the merchant application flow
 * as a full-screen sheet. Closing or submitting returns the user to the
 * merchant login page cleanly (replace: true) so the back button doesn't
 * re-open the form. Unauthenticated visits are redirected to
 * /merchant-login?apply=1 so the intent survives sign-in.
 */
export default function MerchantApplyPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        nav("/merchant-login?apply=1", { replace: true });
        return;
      }
      setReady(true);
    })();
  }, [nav]);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) nav("/merchant-login", { replace: true });
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MerchantApplicationFlow open={open} onOpenChange={handleClose} />
    </div>
  );
}
