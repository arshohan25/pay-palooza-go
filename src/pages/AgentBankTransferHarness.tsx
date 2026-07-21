import { useState } from "react";
import SlideToConfirm from "@/components/SlideToConfirm";
import ModernPinField from "@/components/ModernPinField";

/**
 * Dev/test-only harness that mirrors the AgentBankTransfer state machine
 * (form → preview → pin → confirm(slider) → done) without hitting Supabase.
 *
 * PIN "1234" is treated as valid; anything else is rejected. This lets the
 * E2E suite verify the flow's key contract:
 *   1. Preview screen appears between form and PIN.
 *   2. After PIN is verified, the confirmation screen with the Slide-to-Confirm
 *      slider stays visible (the flow does NOT jump straight to done).
 *   3. Back from confirm returns to PIN; back from PIN returns to preview.
 *   4. The slider is disabled until the PIN is verified.
 *
 * Mounted at /__test/agent-bank-transfer-harness in dev builds (see App.tsx).
 */
type Step = "form" | "preview" | "pin" | "confirm" | "done";

export default function AgentBankTransferHarness() {
  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState("1000");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinVerified, setPinVerified] = useState(false);

  const handleVerifyPin = () => {
    if (pin === "1234") {
      setPinVerified(true);
      setPinError("");
      setStep("confirm");
    } else {
      setPinError("Incorrect PIN.");
      setPin("");
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 480 }}>
      <h1 data-testid="title">Agent Bank Transfer Harness</h1>
      <p data-testid="step">step:{step}</p>
      <p data-testid="pin-verified">pinVerified:{String(pinVerified)}</p>

      {step === "form" && (
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            data-testid="amount-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          />
          <button
            data-testid="form-continue"
            onClick={() => setStep("preview")}
            disabled={!amount || Number(amount) < 10}
          >
            Continue
          </button>
        </div>
      )}

      {step === "preview" && (
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <p data-testid="preview-amount">Amount: ৳{amount}</p>
          <button data-testid="preview-continue" onClick={() => setStep("pin")}>
            Continue
          </button>
          <button data-testid="preview-back" onClick={() => setStep("form")}>
            Back
          </button>
        </div>
      )}

      {step === "pin" && (
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <ModernPinField
            value={pin}
            onChange={(v) => {
              setPin(v);
              setPinError("");
            }}
          />
          {pinError && (
            <p data-testid="pin-error" style={{ color: "crimson" }}>
              {pinError}
            </p>
          )}
          <button
            data-testid="pin-verify"
            onClick={handleVerifyPin}
            disabled={pin.length !== 4}
          >
            Verify PIN
          </button>
          <button
            data-testid="pin-back"
            onClick={() => {
              setStep("preview");
              setPin("");
              setPinError("");
              setPinVerified(false);
            }}
          >
            Back
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <p data-testid="confirm-amount">Amount: ৳{amount}</p>
          <div data-testid="slider-wrapper">
            <SlideToConfirm
              onConfirm={() => setStep("done")}
              disabled={!pinVerified}
              label="Slide to send"
            />
          </div>
          <button data-testid="confirm-back" onClick={() => setStep("pin")}>
            Back
          </button>
        </div>
      )}

      {step === "done" && (
        <div style={{ marginTop: 16 }}>
          <p data-testid="done-message">Transfer complete</p>
        </div>
      )}
    </div>
  );
}
