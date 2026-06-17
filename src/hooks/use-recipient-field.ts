import { useCallback, useMemo, useState } from "react";
import {
  validateRecipient,
  type RecipientKind,
  type RecipientCheck,
} from "@/lib/recipientValidation";

export interface UseRecipientFieldResult extends RecipientCheck {
  /** Current raw input value. */
  value: string;
  /** Drop-in onChange handler (resets external error states is caller's job). */
  setValue: (v: string) => void;
  /** Whether to show the inline error (after blur or after typing started). */
  showError: boolean;
  /** Call from input's onBlur to surface validation. */
  onBlur: () => void;
  /** Whether the Continue button should render. */
  canContinue: boolean;
}

/**
 * Wires a recipient ID/number input to the centralized validation schema.
 * Returns value, change handler, validation result, and a `canContinue`
 * boolean for the Continue button — so any new flow can stay consistent
 * with the rest of the app in three lines:
 *
 *   const r = useRecipientField("merchantId");
 *   <Input value={r.value} onChange={(e) => r.setValue(e.target.value)} />
 *   {r.canContinue && <Button onClick={...}>Continue</Button>}
 */
export function useRecipientField(
  kind: RecipientKind,
  initialValue = "",
  label?: string
): UseRecipientFieldResult {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  const check = useMemo(
    () => validateRecipient(kind, value, label),
    [kind, value, label]
  );

  const onBlur = useCallback(() => setTouched(true), []);

  const showError =
    !!check.errorMessage && (touched || (!check.isEmpty && !check.isValid));

  return {
    ...check,
    value,
    setValue,
    showError,
    onBlur,
    canContinue: check.isValid,
  };
}
