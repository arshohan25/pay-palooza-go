import { useMemo, useState } from "react";
import { useRecipientField } from "@/hooks/use-recipient-field";

/**
 * Dev/test-only harness that mirrors the CashOut flow's first three steps
 * (recipient → amount → confirm) using the SAME `useRecipientField("agentId")`
 * hook the real flow uses. The E2E suite drives this page to verify the
 * Continue button gating contract that the real CashOutFlow relies on.
 *
 * Mounted at /__test/cashout-harness only in dev builds (see App.tsx).
 */
type Step = "agent" | "amount" | "confirm";

const MIN_AMOUNT = 50;
const MAX_AMOUNT = 25_000;

export default function CashOutHarness() {
  const [step, setStep] = useState<Step>("agent");
  const recipient = useRecipientField("agentId");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);

  const parsedAmount = useMemo(() => {
    const n = Number(amount.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const amountError =
    parsedAmount <= 0
      ? "Enter an amount."
      : parsedAmount < MIN_AMOUNT
      ? `Minimum cash-out amount is ৳${MIN_AMOUNT}.`
      : parsedAmount > MAX_AMOUNT
      ? `Maximum cash-out amount is ৳${MAX_AMOUNT}.`
      : "";
  const amountValid = !amountError;
  const showAmountError = amountTouched && !!amountError && amount.length > 0;

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
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <h2 data-testid="amount-heading">Enter Amount</h2>
          <p>
            Recipient: <span data-testid="recipient-normalized">{recipient.normalized}</span>
          </p>
          <label htmlFor="amount">Amount (৳)</label>
          <input
            id="amount"
            data-testid="amount-input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setAmountTouched(true)}
            placeholder={`${MIN_AMOUNT}–${MAX_AMOUNT}`}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          />
          {showAmountError && (
            <p data-testid="amount-error" style={{ color: "crimson", fontSize: 12 }}>
              {amountError}
            </p>
          )}
          <button
            data-testid="amount-continue"
            disabled={!amountValid}
            onClick={() => setStep("confirm")}
            style={{
              padding: 10,
              borderRadius: 6,
              background: amountValid ? "#2563eb" : "#cbd5e1",
              color: "white",
              border: 0,
            }}
          >
            Continue
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div style={{ marginTop: 16 }}>
          <h2 data-testid="confirm-heading">Confirm Cash-Out</h2>
          <p>
            Send <span data-testid="confirm-amount">৳{parsedAmount}</span> to{" "}
            <span data-testid="confirm-recipient">{recipient.normalized}</span>
          </p>
        </div>
      )}
    </div>
  );
}
