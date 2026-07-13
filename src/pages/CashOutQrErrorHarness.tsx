import { useState } from "react";
import { parseCashOutQrPayload } from "@/lib/cashoutQrPayload";
import { useI18n } from "@/lib/i18n";

/**
 * Dev/test-only harness. Drives the SAME `parseCashOutQrPayload` used by
 * CashOutFlow so E2E can prove the user-facing error text is surfaced (and
 * the flow is NOT advanced) when a malformed / non-agent QR is scanned.
 *
 * Mounted at /__test/cashout-qr-error-harness in dev builds only.
 */
type Step = "agent" | "amount";

const AGENT_WALLET_RE = /^EZP-AGN[A-Z]{2}-[A-Z]{4}$/i;

export default function CashOutQrErrorHarness() {
  const { t } = useI18n();
  const [payload, setPayload] = useState("");
  const [agentId, setAgentId] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("agent");

  const handleScan = () => {
    setError("");
    const { value, error: qrErr } = parseCashOutQrPayload(payload, t);
    setAgentId(value);
    if (qrErr) { setError(qrErr); return; }
    if (!value) { setError(t("coQrUnreadable")); return; }
    if (!AGENT_WALLET_RE.test(value)) {
      // Bare phone / territory input still advances only when it's a valid
      // agent wallet — mirrors CashOutFlow's downstream RPC gate.
      setError(t("coQrNotAgent"));
      return;
    }
    setStep("amount");
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 560 }}>
      <h1 data-testid="title">CashOut QR Error Harness</h1>
      <p data-testid="step">step:{step}</p>

      <label htmlFor="qr-payload">QR payload</label>
      <input
        id="qr-payload"
        data-testid="qr-payload-input"
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, marginTop: 4 }}
      />
      <button
        data-testid="qr-scan-btn"
        onClick={handleScan}
        style={{ marginTop: 12, padding: "8px 14px", background: "#2563eb", color: "white", border: 0, borderRadius: 6 }}
      >
        Scan
      </button>

      <p data-testid="agent-id">agent:{agentId}</p>
      {error && (
        <p data-testid="qr-error" style={{ color: "crimson", marginTop: 12 }}>
          {error}
        </p>
      )}
      {step === "amount" && (
        <section data-testid="amount-panel" style={{ marginTop: 12, padding: 12, border: "2px solid #16a34a", borderRadius: 8 }}>
          Amount step (should NOT appear for malformed/non-agent QR)
        </section>
      )}
    </div>
  );
}
