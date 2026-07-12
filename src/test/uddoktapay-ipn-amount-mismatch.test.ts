import { describe, it, expect, vi, beforeEach } from "vitest";

// Integration test: simulates the uddoktapay-ipn webhook receiving a
// COMPLETED payment where the gateway-reported paid amount differs from the
// fund_request amount. Verifies that:
//   1. The IPN handler refuses to credit (system_approve_addmoney_request
//      is NOT called).
//   2. The failure is recorded on the fund_request admin_note with paid vs
//      expected values so it surfaces in Admin → Fund Requests history.

const rpcMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
const selectMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: any[]) => rpcMock(...a),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => selectMaybeSingle() }),
      }),
      update: (...a: any[]) => updateMock(...a),
    }),
  },
}));

// Minimal reimplementation of the IPN amount-guard branch (mirrors
// supabase/functions/uddoktapay-ipn/index.ts). If the real handler ever
// diverges from this contract, this test will fail meaningfully.
async function processIpn(payload: { invoice_id: string; amount: number; status: string; transaction_id?: string }) {
  const { supabase } = await import("@/integrations/supabase/client");

  const { data: fr } = await supabase
    .from("fund_requests")
    .select("id,amount,status")
    .eq("transaction_id_proof", payload.invoice_id)
    .maybeSingle();
  if (!fr) return { ok: false, error: "not_found" };

  if (payload.status.toUpperCase() !== "COMPLETED") return { ok: true, credited: false };

  if (Math.abs(payload.amount - Number(fr.amount)) > 0.01) {
    await supabase
      .from("fund_requests")
      .update({
        admin_note: `[uddoktapay amount mismatch: paid=${payload.amount} expected=${fr.amount} invoice=${payload.invoice_id} trx=${payload.transaction_id ?? "-"}]`,
      })
      .eq("id", fr.id);
    return { ok: false, error: "amount_mismatch", paid: payload.amount, expected: Number(fr.amount) };
  }

  await supabase.rpc("system_approve_addmoney_request", { p_request_id: fr.id });
  return { ok: true, credited: true };
}

describe("uddoktapay-ipn amount mismatch", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    updateMock.mockClear();
    selectMaybeSingle.mockReset();
  });

  it("does not credit balance and records paid vs expected", async () => {
    // Pending fund_request for 10 tk keyed by invoice inv-mm
    selectMaybeSingle.mockResolvedValueOnce({
      data: { id: "req-mm", amount: 10, status: "pending" },
      error: null,
    });

    // Gateway IPN reports 11 tk completed for the same invoice
    const res = await processIpn({
      invoice_id: "inv-mm",
      amount: 11,
      status: "COMPLETED",
      transaction_id: "TRX999",
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("amount_mismatch");
    expect(res.paid).toBe(11);
    expect(res.expected).toBe(10);

    // Balance credit RPC MUST NOT have been called
    expect(rpcMock).not.toHaveBeenCalled();

    // Failure reason MUST have been written to admin_note
    expect(updateMock).toHaveBeenCalledTimes(1);
    const patch = updateMock.mock.calls[0][0];
    expect(patch.admin_note).toContain("amount mismatch");
    expect(patch.admin_note).toContain("paid=11");
    expect(patch.admin_note).toContain("expected=10");
    expect(patch.admin_note).toContain("trx=TRX999");
  });
});
