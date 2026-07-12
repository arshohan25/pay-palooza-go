import { useMemo, useState } from "react";
import {
  generateWalletId,
  validateWalletId,
  KNOWN_ROUTE_CODES,
  isKnownRouteCode,
  type WalletRole,
} from "@/lib/walletId";

/**
 * Dev/test-only harness for the wallet-ID setup flow used by agents,
 * merchants, and personal users.
 *
 * Drives the same primitives production code uses:
 *   - `generateWalletId(seed, role, route)`
 *   - `validateWalletId(id, role)`  (route-aware for agent/merchant)
 *   - `KNOWN_ROUTE_CODES`           (client mirror of `wallet_route_codes`)
 *
 * Exercised by `e2e/wallet-setup.spec.ts` to prove:
 *   - Agent setup with a valid district route code advances to the next step.
 *   - Merchant application persists `route_code` alongside the wallet ID.
 *   - Personal user wallets do NOT expose a district picker and skip the
 *     route check entirely (validation still succeeds).
 *
 * Mounted at /__test/wallet-setup-harness only in dev builds (see App.tsx).
 */
export default function WalletSetupHarness() {
  const [role, setRole] = useState<WalletRole>("agent");
  const [seed, setSeed] = useState("01711223344");
  const [routeCode, setRouteCode] = useState("DH");
  const [saved, setSaved] = useState<null | {
    role: WalletRole;
    walletId: string;
    route_code: string | null;
    validationOk: boolean;
    validationReason: string | null;
  }>(null);

  const routes = useMemo(
    () => Array.from(KNOWN_ROUTE_CODES).sort(),
    [],
  );

  const needsRoute = role !== "user";
  const routeValid = !needsRoute || isKnownRouteCode(routeCode);

  const handleSubmit = () => {
    const walletId = generateWalletId(seed, role, needsRoute ? routeCode : undefined);
    const v = validateWalletId(walletId, role);
    setSaved({
      role,
      walletId,
      route_code: needsRoute ? routeCode.toUpperCase() : null,
      validationOk: v.ok,
      validationReason: v.reason ?? null,
    });
  };

  const canContinue = routeValid && seed.length > 0;
  const nextReady = !!saved && saved.validationOk;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 560 }}>
      <h1 data-testid="title">Wallet Setup Harness</h1>

      <label style={{ display: "block", marginTop: 12 }}>
        Role:&nbsp;
        <select
          data-testid="role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as WalletRole);
            setSaved(null);
          }}
        >
          <option value="user">user</option>
          <option value="agent">agent</option>
          <option value="merchant">merchant</option>
        </select>
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        Seed (phone):&nbsp;
        <input
          data-testid="seed"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          style={{ padding: 6, border: "1px solid #ccc", borderRadius: 6 }}
        />
      </label>

      {needsRoute ? (
        <label style={{ display: "block", marginTop: 12 }} data-testid="district-picker">
          District (route code):&nbsp;
          <select
            data-testid="route"
            value={routeCode}
            onChange={(e) => setRouteCode(e.target.value)}
          >
            {routes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="ZZ">ZZ (unknown — should fail)</option>
          </select>
        </label>
      ) : (
        // Explicit marker so the e2e test can assert the picker is absent for users.
        <p data-testid="no-district" style={{ marginTop: 12, color: "#64748b" }}>
          Personal user wallets do not use a district route code.
        </p>
      )}

      <button
        data-testid="submit"
        onClick={handleSubmit}
        disabled={!canContinue}
        style={{
          marginTop: 16,
          padding: "8px 14px",
          borderRadius: 6,
          border: 0,
          background: canContinue ? "#2563eb" : "#cbd5e1",
          color: "white",
        }}
      >
        Generate wallet ID
      </button>

      {saved && (
        <>
          <pre
            data-testid="saved"
            style={{ marginTop: 16, background: "#f1f5f9", padding: 12, borderRadius: 6, fontSize: 12 }}
          >
            {JSON.stringify(saved, null, 2)}
          </pre>

          <div style={{ marginTop: 12 }}>
            <span data-testid="next-status">{nextReady ? "ready" : "blocked"}</span>
            <button
              data-testid="next-step"
              disabled={!nextReady}
              style={{
                marginLeft: 12,
                padding: "8px 14px",
                borderRadius: 6,
                border: 0,
                background: nextReady ? "#16a34a" : "#cbd5e1",
                color: "white",
              }}
            >
              Continue to next step
            </button>
          </div>
        </>
      )}
    </div>
  );
}
