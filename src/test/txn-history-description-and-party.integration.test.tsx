import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

/**
 * Integration: TransactionHistory detail sheet
 *
 * Guards two related contracts:
 *  1. Description row is hidden when the sender did not enter a
 *     description — for BOTH sent (debit) and received (credit) rows.
 *  2. The "Name/Party" row shows the counterparty's KYC name — i.e. the
 *     receiver's name on a sent transaction and the sender's name on a
 *     received transaction. The phone row label likewise flips between
 *     "Sender Number" (credit) and "Receiver Number" (debit).
 */

const mockTxns = [
  {
    id: "tx-sent-with-desc",
    short_id: "SENTWDESC001",
    type: "send" as const,
    amount: 500,
    fee: 5,
    commission: 0,
    balance_after: 1000,
    recipient_phone: "01711111111",
    recipient_name: "Rahim Receiver",
    description: "Lunch bill split",
    reference: null,
    status: "completed" as const,
    created_at: new Date("2026-07-10T10:00:00Z").toISOString(),
  },
  {
    id: "tx-sent-no-desc",
    short_id: "SENTNODESC02",
    type: "send" as const,
    amount: 250,
    fee: 5,
    commission: 0,
    balance_after: 750,
    recipient_phone: "01722222222",
    recipient_name: "Karim Receiver",
    description: "",
    reference: null,
    status: "completed" as const,
    created_at: new Date("2026-07-10T11:00:00Z").toISOString(),
  },
  {
    id: "tx-recv-with-desc",
    short_id: "RECVWDESC003",
    type: "receive" as const,
    amount: 300,
    fee: 0,
    commission: 0,
    balance_after: 1050,
    recipient_phone: "01733333333",
    recipient_name: "Salma Sender",
    description: "Rent share",
    reference: null,
    status: "completed" as const,
    created_at: new Date("2026-07-10T12:00:00Z").toISOString(),
  },
  {
    id: "tx-recv-no-desc",
    short_id: "RECVNODESC04",
    type: "receive" as const,
    amount: 150,
    fee: 0,
    commission: 0,
    balance_after: 1200,
    recipient_phone: "01744444444",
    recipient_name: "Nadia Sender",
    description: "",
    reference: null,
    status: "completed" as const,
    created_at: new Date("2026-07-10T13:00:00Z").toISOString(),
  },
];

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: () => ({
    transactions: mockTxns,
    loading: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, lang: "en", toggleLang: vi.fn() }),
}));

vi.mock("@/hooks/use-pull-to-refresh", () => ({
  usePullToRefresh: () => {},
}));

// Avoid pulling the real supabase client transitively.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

import TransactionHistory from "@/pages/TransactionHistory";

const openTxByName = (name: string) => {
  const node = screen.getAllByText(name)[0];
  const btn = node.closest("button");
  fireEvent.click(btn ?? node);
};

describe("TransactionHistory — description row + party name direction", () => {
  beforeEach(() => cleanup());

  it("hides description row when sent transaction has empty description", () => {
    render(<TransactionHistory />);
    openTxByName("Karim Receiver");
    expect(screen.getByText("thNameParty")).toBeInTheDocument();
    expect(screen.getByText("Karim Receiver")).toBeInTheDocument();
    // Phone label is "Receiver Number" for a debit.
    expect(screen.getByText("thReceiverNumber")).toBeInTheDocument();
    expect(screen.queryByText("thSenderNumber")).not.toBeInTheDocument();
    // No description row rendered.
    expect(screen.queryByText("thDescription")).not.toBeInTheDocument();
  });

  it("hides description row when received transaction has empty description", () => {
    render(<TransactionHistory />);
    openTxByName("Nadia Sender");
    expect(screen.getByText("thNameParty")).toBeInTheDocument();
    expect(screen.getByText("Nadia Sender")).toBeInTheDocument();
    // Phone label is "Sender Number" for a credit.
    expect(screen.getByText("thSenderNumber")).toBeInTheDocument();
    expect(screen.queryByText("thReceiverNumber")).not.toBeInTheDocument();
    expect(screen.queryByText("thDescription")).not.toBeInTheDocument();
  });

  it("shows description row and receiver name on a sent transaction with a description", () => {
    render(<TransactionHistory />);
    openTxByName("Rahim Receiver");
    expect(screen.getByText("Rahim Receiver")).toBeInTheDocument();
    expect(screen.getByText("thReceiverNumber")).toBeInTheDocument();
    expect(screen.getByText("thDescription")).toBeInTheDocument();
    expect(screen.getByText("Lunch bill split")).toBeInTheDocument();
  });

  it("shows description row and sender name on a received transaction with a description", () => {
    render(<TransactionHistory />);
    openTxByName("Salma Sender");
    expect(screen.getByText("Salma Sender")).toBeInTheDocument();
    expect(screen.getByText("thSenderNumber")).toBeInTheDocument();
    expect(screen.getByText("thDescription")).toBeInTheDocument();
    expect(screen.getByText("Rent share")).toBeInTheDocument();
  });
});
