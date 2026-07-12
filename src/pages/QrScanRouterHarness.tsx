import { useState } from "react";
import { parseQrData, type QrFlow } from "@/lib/qrParser";

/**
 * Dev/test-only harness that mirrors the exact routing branch used by
 * `src/pages/Index.tsx` when a QR is scanned via QrScannerModal.
 *
 * The E2E suite pastes a QR payload, clicks "Scan", and asserts:
 *   • agent QR payloads route to the "cashout" panel
 *   • the "sendmoney" panel is NEVER opened for an agent QR
 *
 * Mounted at /__test/qr-scan-router-harness only in dev builds.
 */
type PanelId = "cashout" | "sendmoney" | "payment" | "dynamic_payment" | "unknown";

const flowToPanel = (flow: QrFlow): PanelId =>
  flow === "cashout" ? "cashout"
  : flow === "send" ? "sendmoney"
  : flow === "payment" ? "payment"
  : flow === "dynamic_payment" ? "dynamic_payment"
  : "unknown";

export default function QrScanRouterHarness() {
  const [payload, setPayload] = useState("");
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [identifier, setIdentifier] = useState("");

  const handleScan = () => {
    const parsed = parseQrData(payload);
    setIdentifier(parsed.identifier);
    setPanel(flowToPanel(parsed.flow));
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 560 }}>
      <h1 data-testid="title">QR Scan Router Harness</h1>
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

      <p data-testid="panel" style={{ marginTop: 20 }}>panel:{panel ?? "none"}</p>
      <p data-testid="identifier">identifier:{identifier}</p>

      {panel === "cashout" && (
        <section data-testid="cashout-panel" style={{ padding: 12, marginTop: 12, border: "2px solid #16a34a", borderRadius: 8 }}>
          <h2>Cash Out</h2>
          <p>Agent: <span data-testid="cashout-agent">{identifier}</span></p>
        </section>
      )}
      {panel === "sendmoney" && (
        <section data-testid="sendmoney-panel" style={{ padding: 12, marginTop: 12, border: "2px solid #dc2626", borderRadius: 8 }}>
          <h2>Send Money</h2>
          <p>Recipient: <span data-testid="sendmoney-recipient">{identifier}</span></p>
        </section>
      )}
      {panel === "payment" && (
        <section data-testid="payment-panel" style={{ padding: 12, marginTop: 12 }}>
          <h2>Pay Merchant</h2>
        </section>
      )}
    </div>
  );
}
