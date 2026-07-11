import { describe, it, expect } from "vitest";
import { friendlyError } from "./tool-helpers";

describe("friendlyError — MCP user-facing messages", () => {
  it("maps missing consent errors to a reconnect prompt", () => {
    expect(friendlyError(new Error("Consent has not been granted for this scope"))).toBe(
      "This action needs consent that hasn't been granted yet. Approve the EasyPay consent screen in your AI client and try again.",
    );
  });

  it("maps expired token errors to a reconnect prompt", () => {
    const msg = friendlyError(new Error("JWT expired"));
    expect(msg).toBe(
      "Your sign-in for this assistant has expired. Please reconnect the EasyPay MCP server in your AI client to grant fresh consent.",
    );
    // alternate wording that Supabase sometimes emits
    expect(friendlyError(new Error("Token is expired"))).toContain("expired");
  });

  it("maps invalid tokens distinctly from expired ones", () => {
    expect(friendlyError(new Error("invalid JWT: malformed"))).toBe(
      "The access token supplied to EasyPay is invalid. Reconnect the EasyPay MCP server in your AI client.",
    );
  });

  it("maps RLS / permission-denied to a tool-permission message", () => {
    const expected =
      "You do not have permission to perform this action on your EasyPay account. Check that your account has the required access, then retry.";
    expect(friendlyError(new Error("permission denied for table payment_links"))).toBe(expected);
    expect(friendlyError(new Error("new row violates row-level security policy"))).toBe(expected);
    expect(friendlyError(new Error("RLS: not allowed"))).toBe(expected);
  });

  it("maps not-authenticated to a sign-in prompt", () => {
    expect(friendlyError("not authenticated")).toBe(
      "You are not signed in. Reconnect the EasyPay MCP server and approve the consent screen.",
    );
  });

  it("handles empty / unknown errors gracefully", () => {
    expect(friendlyError(null)).toBe("Something went wrong. Please try again.");
    expect(friendlyError(new Error("kaboom 42"))).toBe(
      "EasyPay could not complete this request: kaboom 42",
    );
  });
});
