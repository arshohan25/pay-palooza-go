import { useState } from "react";
import { useRecipientField } from "@/hooks/use-recipient-field";
import type { RecipientKind } from "@/lib/recipientValidation";

/**
 * Dev/test-only harness page that exercises the `useRecipientField` hook
 * for every supported `RecipientKind`. Used by the Playwright E2E suite
 * (e2e/recipient-validation.spec.ts) to verify that the hook drives the
 * UI consistently with the centralized recipient validation schema.
 *
 * Mounted at /__test/recipient-harness only in dev builds (see App.tsx).
 */
const KIND_OPTIONS: { kind: RecipientKind; label?: string }[] = [
  { kind: "phone" },
  { kind: "agentId" },
  { kind: "merchantId" },
  { kind: "billAccount", label: "Meter No" },
  { kind: "bankAccount" },
  { kind: "accountHolder" },
  { kind: "demoService" },
];

export default function RecipientHarness() {
  const [kind, setKind] = useState<RecipientKind>("agentId");
  const labelForKind = KIND_OPTIONS.find((o) => o.kind === kind)?.label;
  // Re-mount the hook whenever `kind` changes so state resets per scenario.
  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 480 }}>
      <h1 data-testid="title">Recipient Harness</h1>
      <label>
        Kind:&nbsp;
        <select
          data-testid="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as RecipientKind)}
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.kind} value={o.kind}>
              {o.kind}
            </option>
          ))}
        </select>
      </label>
      <HarnessField key={kind} kind={kind} label={labelForKind} />
    </div>
  );
}

function HarnessField({
  kind,
  label,
}: {
  kind: RecipientKind;
  label?: string;
}) {
  const r = useRecipientField(kind, "", label);
  return (
    <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
      <input
        data-testid="recipient-input"
        aria-label="recipient"
        value={r.value}
        onChange={(e) => r.setValue(e.target.value)}
        onBlur={r.onBlur}
        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
      />
      {r.showError && r.errorMessage && (
        <p data-testid="error" style={{ color: "crimson", fontSize: 12 }}>
          {r.errorMessage}
        </p>
      )}
      <button
        data-testid="continue"
        disabled={!r.canContinue}
        style={{
          padding: 10,
          borderRadius: 6,
          background: r.canContinue ? "#2563eb" : "#cbd5e1",
          color: "white",
          border: 0,
        }}
      >
        Continue
      </button>
      <pre data-testid="state" style={{ fontSize: 11, background: "#f1f5f9", padding: 8 }}>
        {JSON.stringify(
          {
            isValid: r.isValid,
            isEmpty: r.isEmpty,
            canContinue: r.canContinue,
            normalized: r.normalized,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
