import { useState } from "react";
import { useRecipientField } from "@/hooks/use-recipient-field";

/**
 * Dev/test-only harness that mirrors the CashOut flow's first two steps
 * (recipient → amount) using the SAME `useRecipientField("agentId")` hook
 * the real flow uses. The E2E suite drives this page to verify that the
 * Continue button is gated on a valid recipient and that clicking it
 * advances the wizard to the next screen.
 *
 * Why a harness instead of the real CashOutFlow?
 *   - The real flow requires auth, KYC, FeatureGuard, geolocation, and a
 *     live `get_nearby_agents` RPC — all impractical in CI. The harness
 *     guarantees the recipient-step contract that the real flow relies on.
 *
 * Mounted at /__test/cashout-harness only in dev builds (see App.tsx).
 */
type Step = "agent" | "amount";

export default function CashOutHarness() {
  const [step, setStep] = useState<Step>("agent");
  const recipient = useRecipientField("agentId");

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 480 }}>
      <h1 data-testid="title">CashOut Harness</h1>
      <p data-testid="step">step:{step}</p>

      {step === "agent" && (
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <label htmlFor="agent-id">Agent ID</label>
          <input
            id="agent-id"
            data-testid="agent-id-input"
            value={recipient.value}
            onChange={(e) => recipient.setValue(e.target.value)}
            onBlur={recipient.onBlur}
            placeholder="e.g. AGT-10234"
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          />
          {recipient.showError && recipient.errorMessage && (
            <p data-testid="agent-error" style={{ color: "crimson", fontSize: 12 }}>
              {recipient.errorMessage}
            </p>
          )}
          {recipient.canContinue && (
            <button
              data-testid="agent-continue"
              onClick={() => setStep("amount")}
              style={{
                padding: 10,
                borderRadius: 6,
                background: "#2563eb",
                color: "white",
                border: 0,
              }}
            >
              Continue
            </button>
          )}
        </div>
      )}

      {step === "amount" && (
        <div style={{ marginTop: 16 }}>
          <h2 data-testid="amount-heading">Enter Amount</h2>
          <p>Recipient: <span data-testid="recipient-normalized">{recipient.normalized}</span></p>
        </div>
      )}
    </div>
  );
}
