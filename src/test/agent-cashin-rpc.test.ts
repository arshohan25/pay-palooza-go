import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "../pages/AgentCashIn.tsx"), "utf8");

describe("AgentCashIn RPC wiring", () => {
  it("uses the dedicated agent_cashin RPC (not transfer_money)", () => {
    expect(src).toContain('supabase.rpc("agent_cashin"');
    expect(src).not.toMatch(/supabase\.rpc\(\s*"transfer_money"/);
  });

  it("passes p_commission so the agent's row records earned commission", () => {
    expect(src).toMatch(/p_commission:\s*commission/);
  });

  it("blocks non-user recipients using is_user_wallet flag", () => {
    expect(src).toContain("is_user_wallet");
  });

  it("enforces customer daily cash-in limit via helper RPC", () => {
    expect(src).toContain("get_customer_daily_cashin_usage");
  });
});
