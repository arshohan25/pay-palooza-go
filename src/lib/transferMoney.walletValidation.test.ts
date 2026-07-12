/**
 * Integration tests: transferMoney() surfaces wallet_id_format errors
 * with the correct code + walletValidation payload, and the flow-level
 * mapping to UI messages produces the expected localized text for
 * bad_format and role_mismatch across all wallet roles.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the supabase client BEFORE importing balanceStore ─────────────────
const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  getCachedSession: async () => null,
}));

import { transferMoney } from "./balanceStore";
import { walletFormatError, type WalletRole } from "./walletId";

/** Mirror of the mapping used in SendMoneyFlow / CashOutFlow / PayPage. */
function mapWalletErrorToUiMessage(
  err: any,
  role: WalletRole,
  lang: "en" | "bn" = "en",
): string {
  if (err?.code === "bad_format" || err?.code === "role_mismatch") {
    return walletFormatError(role, lang);
  }
  return err?.message ?? "Transaction failed";
}

beforeEach(() => rpcMock.mockReset());

describe("transferMoney wallet_id_format error surface", () => {
  it("throws with code=bad_format when server rejects format", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, reason: "bad_format" },
      error: null,
    });

    await expect(
      transferMoney({
        recipientPhone: "01700000000",
        amount: 100,
        recipientWalletId: "NOT-A-WALLET",
        expectedWalletRole: "user",
      }),
    ).rejects.toMatchObject({
      code: "bad_format",
      walletValidation: { ok: false, reason: "bad_format" },
    });
  });

  it("throws with code=role_mismatch when role differs", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, reason: "role_mismatch", role: "agent" },
      error: null,
    });

    await expect(
      transferMoney({
        recipientPhone: "01700000000",
        amount: 100,
        recipientWalletId: "EZP-AGNDH-ABCD",
        expectedWalletRole: "user",
      }),
    ).rejects.toMatchObject({ code: "role_mismatch" });
  });

  it("parses JSON string response from the RPC too", async () => {
    rpcMock.mockResolvedValueOnce({
      data: JSON.stringify({ ok: false, reason: "bad_format" }),
      error: null,
    });

    await expect(
      transferMoney({
        recipientPhone: "01700000000",
        amount: 50,
        recipientWalletId: "EZP-!!!-XXXX",
        expectedWalletRole: "agent",
      }),
    ).rejects.toMatchObject({ code: "bad_format" });
  });

  it("skips validation RPC when no recipientWalletId is provided", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { success: true, recipient_found: true, sender_balance: 900 },
      error: null,
    });

    const res = await transferMoney({
      recipientPhone: "01700000000",
      amount: 100,
    });

    expect(res).toEqual({ success: true, recipientFound: true, senderBalance: 900 });
    // Only the transfer_money RPC was called
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][0]).toBe("transfer_money");
  });
});

describe("wallet error → UI message mapping (matches flow components)", () => {
  const roles: WalletRole[] = ["user", "agent", "merchant"];
  const reasons = ["bad_format", "role_mismatch"] as const;

  for (const role of roles) {
    for (const reason of reasons) {
      it(`maps ${reason} on ${role} flow → English walletFormatError`, async () => {
        rpcMock.mockResolvedValueOnce({
          data: { ok: false, reason },
          error: null,
        });
        try {
          await transferMoney({
            recipientPhone: "01700000000",
            amount: 10,
            recipientWalletId: "EZP-ZZZZ-ZZZZ",
            expectedWalletRole: role as any,
          });
          throw new Error("expected transferMoney to throw");
        } catch (err: any) {
          expect(err.code).toBe(reason);
          expect(mapWalletErrorToUiMessage(err, role, "en")).toBe(
            walletFormatError(role, "en"),
          );
          expect(mapWalletErrorToUiMessage(err, role, "bn")).toBe(
            walletFormatError(role, "bn"),
          );
        }
      });
    }
  }

  it("English message contains the expected format hint", () => {
    expect(walletFormatError("agent", "en")).toContain("EZP-AGN{RR}-XXXX");
    expect(walletFormatError("merchant", "en")).toContain("EZP-MRC{RR}-XXXX");
    expect(walletFormatError("user", "en")).toContain("EZP-XXXX-XXXX");
  });

  it("Bangla message is localized", () => {
    expect(walletFormatError("agent", "bn")).toMatch(/এজেন্ট/);
    expect(walletFormatError("merchant", "bn")).toMatch(/মার্চেন্ট/);
    expect(walletFormatError("user", "bn")).toMatch(/ব্যক্তিগত/);
  });

  it("non-wallet errors fall through to their own message", () => {
    const other = { code: "insufficient_funds", message: "Not enough balance" };
    expect(mapWalletErrorToUiMessage(other, "user", "en")).toBe("Not enough balance");
  });
});
