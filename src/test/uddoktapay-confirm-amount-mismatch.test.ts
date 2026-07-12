import { describe, it, expect, vi, beforeEach } from "vitest";

// Integration test: simulates uddoktapay-confirm-addmoney returning an
// amount_mismatch response (gateway reported a paid amount different from
// the fund_request amount). Verifies that:
//   1. The balance is NOT credited (no system_approve_addmoney_request call).
//   2. The failure reason (paid vs expected) is recorded on the fund_request
//      (admin_note surfaces in Admin → Fund Requests history).

const invokeMock = vi.fn();
const rpcMock = vi.fn();
const fromSelect = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: any[]) => invokeMock(...a) },
    rpc: (...a: any[]) => rpcMock(...a),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => fromSelect() }),
      }),
    }),
  },
}));

describe("uddoktapay-confirm-addmoney amount mismatch", () => {
  beforeEach(() => {
    invokeMock.mockReset(); rpcMock.mockReset(); fromSelect.mockReset();
  });

  it("does not credit balance and records paid vs expected in admin_note", async () => {
    // 1. Pending request for 10 tk
    fromSelect.mockResolvedValueOnce({
      data: { id: "req-mm", status: "pending", amount: 10, source_method: "uddoktapay", transaction_id_proof: "inv-mm" },
      error: null,
    });

    // 2. Edge function refuses because gateway reports 11 tk
    invokeMock.mockResolvedValueOnce({
      data: { ok: false, error: "amount_mismatch", paid: 11, expected: 10 },
      error: null,
    });

    // 3. Reload after failure: still pending, admin_note carries reason
    fromSelect.mockResolvedValueOnce({
      data: {
        id: "req-mm",
        status: "pending",
        amount: 10,
        source_method: "uddoktapay",
        transaction_id_proof: "inv-mm",
        reviewed_at: null,
        admin_note: "[uddoktapay amount mismatch: paid=11 expected=10 invoice=inv-mm trx=TRX123]",
      },
      error: null,
    });

    const { supabase } = await import("@/integrations/supabase/client");

    const before = await supabase.from("fund_requests").select("*").eq("id", "req-mm").maybeSingle();
    expect(before.data.status).toBe("pending");

    const confirm = await supabase.functions.invoke("uddoktapay-confirm-addmoney", { body: { request_id: "req-mm" } });
    expect(confirm.error).toBeNull();
    expect(confirm.data.ok).toBe(false);
    expect(confirm.data.error).toBe("amount_mismatch");
    expect(confirm.data.paid).toBe(11);
    expect(confirm.data.expected).toBe(10);

    const after = await supabase.from("fund_requests").select("*").eq("id", "req-mm").maybeSingle();
    // Balance not credited → still pending, no reviewed_at
    expect(after.data.status).toBe("pending");
    expect(after.data.reviewed_at).toBeNull();
    // Reason recorded for admin history
    expect(after.data.admin_note).toContain("amount mismatch");
    expect(after.data.admin_note).toContain("paid=11");
    expect(after.data.admin_note).toContain("expected=10");

    // The system approval RPC MUST NOT have been invoked
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
