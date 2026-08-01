import { describe, it, expect } from "vitest";
import { parseLimitError, limitErrorMessage, friendlyLimitError } from "@/lib/limitErrors";
import { validateLimitValue } from "@/components/admin/AdminLoyaltyTierLimits";

describe("parseLimitError", () => {
  it("parses a daily amount breach", () => {
    const p = parseLimitError("LIMIT_EXCEEDED|daily|amount|150000|145000|5000|starter");
    expect(p).toEqual({
      period: "daily",
      kind: "amount",
      limit: 150000,
      used: 145000,
      remaining: 5000,
      tierCode: "starter",
    });
  });

  it("parses a monthly count breach even when prefixed by postgres noise", () => {
    const p = parseLimitError('error: LIMIT_EXCEEDED|monthly|count|30|30|0|signature');
    expect(p?.period).toBe("monthly");
    expect(p?.kind).toBe("count");
    expect(p?.limit).toBe(30);
  });

  it("returns null for unrelated errors", () => {
    expect(parseLimitError("insufficient balance")).toBeNull();
    expect(parseLimitError(null)).toBeNull();
  });
});

describe("limitErrorMessage", () => {
  it("reports remaining amount for a daily breach", () => {
    const msg = limitErrorMessage(parseLimitError("LIMIT_EXCEEDED|daily|amount|150000|148000|2000|starter")!);
    expect(msg).toContain("2,000");
    expect(msg).toContain("150,000");
  });

  it("reports the monthly variant", () => {
    const msg = limitErrorMessage(parseLimitError("LIMIT_EXCEEDED|monthly|amount|400000|399000|1000|signature")!);
    expect(msg.toLowerCase()).toContain("monthly");
    expect(msg).toContain("400,000");
  });

  it("reports count breaches", () => {
    const msg = limitErrorMessage(parseLimitError("LIMIT_EXCEEDED|daily|count|20|20|0|gold")!);
    expect(msg).toContain("20");
  });

  it("friendlyLimitError passes non-limit errors through as null", () => {
    expect(friendlyLimitError({ message: "network down" })).toBeNull();
    expect(friendlyLimitError({ message: "LIMIT_EXCEEDED|daily|amount|150000|150000|0|starter" })).toBeTruthy();
  });
});

describe("validateLimitValue", () => {
  it("rejects empty, negative and decimal input", () => {
    expect(validateLimitValue("max_amount", "")).toBeTruthy();
    expect(validateLimitValue("max_amount", "-100")).toBe("Cannot be negative");
    expect(validateLimitValue("max_amount", "150.5")).toBe("Whole numbers only");
  });

  it("enforces sensible upper bounds", () => {
    expect(validateLimitValue("max_amount", "999999999")).toContain("Max");
    expect(validateLimitValue("max_count", "5000")).toContain("Max");
  });

  it("accepts valid whole numbers", () => {
    expect(validateLimitValue("max_amount", "150000")).toBeNull();
    expect(validateLimitValue("max_count", "20")).toBeNull();
    expect(validateLimitValue("max_amount", "0")).toBeNull();
  });
});
