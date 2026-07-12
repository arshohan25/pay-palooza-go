import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

/**
 * Accessibility regression tests for the Customer KYC sheet inside
 * AgentMenuDrawer. Verifies that:
 *
 *  - The error state announces itself (role="alert") and the Retry button
 *    is keyboard-reachable + properly labeled.
 *  - The retry cooldown disables the button and exposes a live countdown.
 *  - The success confirmation banner uses role="status" + aria-live.
 *  - The long-reason toggle is a real <button>, sets aria-expanded, points
 *    aria-controls at the region it expands, and is fully keyboard-driven.
 */

const AGENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LONG =
  "The submitted NID photo is blurry, the address on the utility bill does not match the profile address, and the selfie was taken in poor lighting so we cannot confirm the customer's identity — please re-submit all three documents in clear light.";

let rpcMode: "ok" | "error" = "ok";
const rpcMock = vi.fn(async (name: string, params: any) => {
  if (name === "get_agent_customer_kyc") {
    if (rpcMode === "error") return { data: null, error: { message: "Network request failed" } };
    return {
      data: [
        { user_id: "c1", name: "Alice", phone: "017", status: "verified", rejection_reason: null, updated_at: "2026-01-01" },
        { user_id: "c2", name: "Bob",   phone: "018", status: "rejected", rejection_reason: LONG, updated_at: "2026-01-05" },
      ],
      error: null,
    };
  }
  if (name === "get_agent_kyc_audit") return { data: [], error: null };
  return { data: null, error: null };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, params?: any) => rpcMock(name, params),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: AGENT }, signOut: vi.fn(), loading: false, isAuthenticated: true }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ name: "Agent", phone: "017", avatar_url: null, displayName: "Agent" }),
}));
vi.mock("@/hooks/use-global-toggles", () => ({
  useGlobalToggles: () => ({ isDisabled: () => false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, lang: "en", toggleLang: vi.fn() }),
}));

import AgentMenuDrawer from "@/components/AgentMenuDrawer";

function openSheetAndRender() {
  const utils = render(
    <MemoryRouter>
      <AgentMenuDrawer
        open={true}
        onClose={() => {}}
        agentInfo={{
          business_name: "Test",
          commission_earned: 0,
          max_float: 0,
          customers_onboarded: 0,
          status: "active",
          territory_code: "DH",
        }}
        recentTxns={[]}
      />
    </MemoryRouter>,
  );
  return utils;
}

async function openKycSheet(user: ReturnType<typeof userEvent.setup>) {
  // The "Customer KYC" account item opens the sheet.
  const trigger = await screen.findByRole("button", { name: /agCustomerKyc/i });
  await user.click(trigger);
}

describe("AgentMenuDrawer Customer KYC — accessibility", () => {
  beforeEach(() => {
    rpcMode = "ok";
    rpcMock.mockClear();
    cleanup();
  });

  it("error state is announced and Retry is keyboard-navigable + labeled", async () => {
    const user = userEvent.setup();
    rpcMode = "error";
    openSheetAndRender();
    await openKycSheet(user);

    const errorRegion = await screen.findByTestId("customer-kyc-error");
    expect(errorRegion).toHaveAttribute("role", "alert");
    expect(errorRegion).toHaveAttribute("aria-live", "assertive");

    const retry = screen.getByTestId("kyc-retry-btn");
    // Real <button>, discoverable via role + accessible name.
    expect(retry.tagName).toBe("BUTTON");
    expect(retry).toHaveAccessibleName(/retry/i);
    // Describes itself with the error message + cooldown status.
    expect(retry.getAttribute("aria-describedby") || "").toMatch(/kyc-error-desc/);

    // Keyboard reachable: focus via TAB lands on it, Enter triggers a fetch.
    retry.focus();
    expect(document.activeElement).toBe(retry);
    rpcMock.mockClear();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("get_agent_customer_kyc", { _agent_id: AGENT }));
  });

  it("retry cooldown disables the button and exposes a live countdown", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: (n) => vi.advanceTimersByTime(n) });
    rpcMode = "error";
    openSheetAndRender();
    await openKycSheet(user);

    // Wait for the initial failed fetch to arm the cooldown.
    const retry = await screen.findByTestId("kyc-retry-btn");
    await waitFor(() => expect(retry).toBeDisabled());

    // Countdown region is polite so screen readers announce time remaining.
    const cooldown = screen.getByTestId("kyc-retry-cooldown");
    expect(cooldown).toHaveAttribute("aria-live", "polite");
    expect(cooldown.textContent || "").toMatch(/\d+\s*s/);

    // Attempting a click while disabled must not fire another request.
    rpcMock.mockClear();
    await user.click(retry).catch(() => {});
    expect(rpcMock).not.toHaveBeenCalled();

    // After the cooldown elapses (max 60s), the button re-enables.
    await act(async () => { vi.advanceTimersByTime(65_000); });
    await waitFor(() => expect(retry).not.toBeDisabled());
    vi.useRealTimers();
  });

  it("long rejection reason toggle uses <button> + aria-expanded + aria-controls, driven by keyboard", async () => {
    const user = userEvent.setup();
    openSheetAndRender();
    await openKycSheet(user);

    const toggle = await screen.findByTestId("kyc-rejection-toggle");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "kyc-latest-rejection-reason-text");
    expect(toggle).toHaveAccessibleName(/rejection reason/i);

    // The controlled region actually exists in the DOM.
    const region = document.getElementById("kyc-latest-rejection-reason-text");
    expect(region).not.toBeNull();

    // Keyboard: focus + Space toggles state; Enter toggles back.
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    await user.keyboard(" ");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
  });

  it("success confirmation banner is a polite live region", async () => {
    // Simulate the drawer already loaded with data, then force a refresh that
    // marks the update — the drawer surfaces the kyc-updated-banner.
    const user = userEvent.setup();
    openSheetAndRender();
    await openKycSheet(user);

    // Trigger the Update button — that arms a focus-listener that will
    // call fetchCustomerKyc({ markRefresh: true }) on window focus.
    const updateBtn = await screen.findByTestId("kyc-update-btn");
    expect(updateBtn).toHaveAccessibleName(/update customer kyc/i);
    await user.click(updateBtn);

    // Fire a window focus to simulate the agent returning from the update flow.
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    const banner = await screen.findByTestId("kyc-updated-banner");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner).toHaveAttribute("aria-atomic", "true");
    expect(banner).toHaveTextContent(/updated successfully/i);
  });
});
