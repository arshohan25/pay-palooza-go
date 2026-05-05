import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue({
    data: { processed: 1, missed: 0, dedup: 0, settled: 0, perSchedule: [{ schedule_id: "s1", outcome: "collected" }] },
    error: null,
  }),
}));

const baseScheds = [
  {
    id: "s1", user_id: "u1", amount: 100, frequency: "daily",
    is_active: true, settled: false, total_paid: 2, total_installments: 30,
    missed_count: 0, last_run_at: new Date().toISOString(),
    next_run_at: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "s2", user_id: "u2", amount: 500, frequency: "weekly",
    is_active: false, settled: true, total_paid: 12, total_installments: 12,
    missed_count: 0, last_run_at: new Date().toISOString(), next_run_at: null,
  },
];

const baseLogs = [
  {
    id: "l1", schedule_id: "s1", user_id: "u1", outcome: "collected",
    reason: "Collected to Goal", amount: 100, triggered_by: "cron",
    created_at: new Date().toISOString(),
  },
];

const baseProfiles = [
  { user_id: "u1", name: "Alice", phone: "01700000001" },
  { user_id: "u2", name: "Bob", phone: "01700000002" },
];

function tableMock(name: string) {
  if (name === "savings_auto_save") {
    return {
      select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: baseScheds, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    };
  }
  if (name === "dps_run_log") {
    return {
      select: () => ({
        order: () => ({ limit: () => Promise.resolve({ data: baseLogs, error: null }) }),
        eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: baseLogs, error: null }) }) }),
      }),
    };
  }
  if (name === "profiles") {
    return {
      select: () => ({ in: () => Promise.resolve({ data: baseProfiles, error: null }) }),
    };
  }
  return { select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) };
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (n: string) => tableMock(n),
    functions: { invoke },
    channel: () => ({
      on: function () { return this; },
      subscribe: function () { return this; },
    }),
    removeChannel: () => {},
  },
}));

import AdminAutoSaveMonitor from "@/components/admin/AdminAutoSaveMonitor";

describe("AdminAutoSaveMonitor", () => {
  beforeEach(() => { invoke.mockClear(); });

  it("renders schedule rows and run logs", async () => {
    render(<AdminAutoSaveMonitor />);
    expect(await screen.findAllByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 30/)).toBeInTheDocument();
    expect(screen.getByText(/Recent processing runs/)).toBeInTheDocument();
    expect(screen.getAllByText(/collected/i).length).toBeGreaterThan(0);
  });

  it("triggers process-auto-save with force=true when 'Run now' clicked", async () => {
    render(<AdminAutoSaveMonitor />);
    await screen.findAllByText(/Alice/);
    // Find the "Run now" buttons (Play icon). Use title attribute.
    const runButtons = screen.getAllByTitle("Run now");
    fireEvent.click(runButtons[0]);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("process-auto-save", { body: { schedule_id: "s1", force: true } });
    });
  });

  it("triggers cron tick (no schedule_id) when 'Run cron tick' clicked", async () => {
    render(<AdminAutoSaveMonitor />);
    await screen.findAllByText(/Alice/);
    fireEvent.click(screen.getByRole("button", { name: /Run cron tick/i }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("process-auto-save", { body: {} });
    });
  });
});
