/**
 * End-to-end style test:
 * 1. AddMoney status page renders the gateway Txn ID as a link to
 *    /admin?gateway_txn=<trx>#fund_requests.
 * 2. Clicking that link lands on Admin → Fund Requests with the search prefilled.
 * 3. The filter narrows the list to the matching record.
 * 4. The CSV export contains exactly that one filtered record.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const TRX = "TRX-LINK-123";
const ROW_MATCH = {
  id: "fr-match", user_id: "u1", type: "add_money", amount: 500, status: "pending",

  source_method: "uddoktapay", proof_url: null,
  transaction_id_proof: TRX, bank_name: null, account_number: null, account_holder: null,
  admin_note: `invoice=inv-1 trx=${TRX}`, reviewed_by: "admin", reviewed_at: "2026-07-12T12:00:00Z",
  created_at: "2026-07-12T11:00:00Z", updated_at: "2026-07-12T12:00:00Z",
};
const ROW_OTHER = { ...ROW_MATCH, id: "fr-other", user_id: "u2", amount: 999, transaction_id_proof: "OTHER-XYZ", admin_note: null };

const STATUS_ROW = {
  id: "req-1", status: "approved", amount: 500, reviewed_at: "2026-07-12T12:00:00Z",
  transaction_id_proof: TRX, admin_note: null, source_method: "uddoktapay",
  created_at: "2026-07-12T11:00:00Z",
};

vi.mock("@/integrations/supabase/client", () => {
  const table = (name: string) => {
    const state = { name, filters: {} as any };
    const builder: any = {
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      in: () => builder,
      eq: (col: string, val: any) => { state.filters[col] = val; return builder; },
      maybeSingle: async () => ({ data: state.name === "fund_requests" ? STATUS_ROW : null, error: null }),
      then: undefined,
    };
    // make awaitable
    builder.then = (resolve: any) => {
      if (state.name === "fund_requests") resolve({ data: [ROW_MATCH, ROW_OTHER], error: null });
      else if (state.name === "profiles") resolve({
        data: [
          { user_id: "u1", name: "Alice", phone: "0170000001", balance: 100 },
          { user_id: "u2", name: "Bob", phone: "0170000002", balance: 50 },
        ], error: null,
      });
      else resolve({ data: [], error: null });
    };
    return builder;
  };
  return {
    supabase: {
      from: (name: string) => table(name),
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => {},
      functions: { invoke: async () => ({ data: {}, error: null }) },
    },
  };
});

import AddMoneyStatusPage from "@/pages/AddMoneyStatusPage";
import AdminFundRequests from "@/components/admin/AdminFundRequests";

function AppShell() {
  return (
    <Routes>
      <Route path="/status" element={<AddMoneyStatusPage />} />
      <Route path="/admin" element={<AdminFundRequests />} />
    </Routes>
  );
}

describe("AddMoney → Admin gateway Txn link e2e", () => {
  beforeEach(() => {
    (globalThis as any).__lastBlobText = "";
    const OrigBlob = globalThis.Blob;
    (globalThis as any).Blob = class extends OrigBlob {
      constructor(parts: any[], opts?: any) {
        super(parts, opts);
        (globalThis as any).__lastBlobText = parts.map((p) => String(p)).join("");
      }
    };
    (globalThis as any).URL.createObjectURL = () => "blob:mock";
    (globalThis as any).URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
  });


  it("links from status page to admin filtered view and exports matching CSV row", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/status?request_id=req-1`]}>
        <AppShell />
      </MemoryRouter>
    );

    const link = await screen.findByTestId("gateway-trx-id");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(`/admin?gateway_txn=${encodeURIComponent(TRX)}#fund_requests`);
    unmount();

    // Simulate landing on the admin page from that link.
    // AdminFundRequests reads window.location.search to prefill gateway_txn, so set it BEFORE render.
    window.history.replaceState({}, "", `/admin?gateway_txn=${encodeURIComponent(TRX)}#fund_requests`);
    render(
      <MemoryRouter initialEntries={[`/admin?gateway_txn=${encodeURIComponent(TRX)}#fund_requests`]}>
        <AppShell />
      </MemoryRouter>
    );


    await waitFor(() => {
      // Only the matching row should be visible via export count button
      const btn = screen.getByTestId("export-csv");
      expect(btn.textContent).toMatch(/Export CSV \(1\)/);
    });

    fireEvent.click(screen.getByTestId("export-csv"));

    await waitFor(() => {
      const csv = (globalThis as any).__lastBlobText as string;
      expect(csv).toContain("gateway_txn_id");
      expect(csv).toContain(TRX);
      expect(csv).not.toContain("OTHER-XYZ");
      // header + exactly one row
      const lines = csv.trim().split("\n");
      expect(lines.length).toBe(2);
    });
  });
});
