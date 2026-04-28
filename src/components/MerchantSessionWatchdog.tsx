import { useMerchantSessionWatchdog } from "@/hooks/use-merchant-session-watchdog";

/**
 * Mounts the merchant session watchdog. Renders nothing.
 * Place once inside <BrowserRouter>; the hook itself no-ops outside `/merchant*` routes.
 */
const MerchantSessionWatchdog = () => {
  useMerchantSessionWatchdog();
  return null;
};

export default MerchantSessionWatchdog;
