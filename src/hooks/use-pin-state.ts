import { useState, useCallback } from "react";

/**
 * Centralized PIN state management.
 * Ensures consistent reset behaviour across all transaction flows.
 */
export function usePinState(initialPin = "") {
  const [pin, setPin] = useState(initialPin);
  const [pinError, setPinError] = useState("");

  /** Clear both PIN value and any error message */
  const clearPin = useCallback(() => {
    setPin("");
    setPinError("");
  }, []);

  /** Clear PIN + set an error message (default: "Incorrect PIN. Please try again.") */
  const failPin = useCallback((msg?: string) => {
    setPin("");
    setPinError(msg || "Incorrect PIN. Please try again.");
  }, []);

  return { pin, setPin, pinError, setPinError, clearPin, failPin } as const;
}
