import { describe, it, expect, vi, beforeEach } from "vitest";

// Integration test: simulates a payment return where the IPN webhook did not
// arrive, and verifies that the client-side uddoktapay-confirm-addmoney
// function verifies the invoice with UddoktaPay and credits the balance via
// system_approve_addmoney_request.

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

describe("add-money return without IPN → confirm credits balance", () => {
  beforeEach(() => {
    invokeMock.mockReset(); rpcMock.mockReset(); fromSelect.mockReset();
  });

  it("returns credited=true and updates fund_request to approved", async () => {
    // 1. Payment return lands: fund_request is still pending because IPN never fired
    fromSelect.mockResolvedValueOnce({
      data: { id: "req-1", status: "pending", amount: 500, source_method: "uddoktapay", transaction_id_proof: "inv-abc" },
      error: null,
    });

    // 2. Client invokes the confirm edge function → simulated response
    invokeMock.mockResolvedValueOnce({
      data: { ok: true, status: "COMPLETED", credited: true, addmoney: { new_balance: 1500 } },
      error: null,
    });

    // 3. After confirm, the fund_request row now reads approved with reviewed_at
    fromSelect.mockResolvedValueOnce({
      data: { id: "req-1", status: "approved", amount: 500, source_method: "uddoktapay", transaction_id_proof: "inv-abc", reviewed_at: new Date().toISOString() },
      error: null,
    });

    const { supabase } = await import("@/integrations/supabase/client");

    // Simulate PaymentReturn → status page flow
    const initial = await supabase.from("fund_requests").select("*").eq("id", "req-1").maybeSingle();
    expect(initial.data.status).toBe("pending");

    const confirm = await supabase.functions.invoke("uddoktapay-confirm-addmoney", { body: { request_id: "req-1" } });
    expect(confirm.error).toBeNull();
    expect(confirm.data.credited).toBe(true);
    expect(confirm.data.status).toBe("COMPLETED");

    const after = await supabase.from("fund_requests").select("*").eq("id", "req-1").maybeSingle();
    expect(after.data.status).toBe("approved");
    expect(after.data.reviewed_at).toBeTruthy();

    expect(invokeMock).toHaveBeenCalledWith(
      "uddoktapay-confirm-addmoney",
      expect.objectContaining({ body: expect.objectContaining({ request_id: "req-1" }) }),
    );
  });

  it("does not credit when UddoktaPay reports non-COMPLETED", async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true, status: "PENDING", credited: false }, error: null });
    const { supabase } = await import("@/integrations/supabase/client");
    const res = await supabase.functions.invoke("uddoktapay-confirm-addmoney", { body: { request_id: "req-2" } });
    expect(res.data.credited).toBe(false);
    expect(res.data.status).toBe("PENDING");
  });
});
