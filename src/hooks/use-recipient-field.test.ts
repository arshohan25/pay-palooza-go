import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRecipientField } from "./use-recipient-field";

describe("useRecipientField", () => {
  it("starts empty, no error, cannot continue", () => {
    const { result } = renderHook(() => useRecipientField("merchantId"));
    expect(result.current.value).toBe("");
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.canContinue).toBe(false);
    expect(result.current.showError).toBe(false);
    expect(result.current.errorMessage).toBe("");
  });

  it("accepts an initial value and validates it", () => {
    const { result } = renderHook(() => useRecipientField("merchantId", "MERCH123"));
    expect(result.current.value).toBe("MERCH123");
    expect(result.current.canContinue).toBe(true);
  });

  it("setValue updates the input and re-runs validation", () => {
    const { result } = renderHook(() => useRecipientField("agentId"));
    act(() => result.current.setValue("AG1"));
    expect(result.current.value).toBe("AG1");
    expect(result.current.canContinue).toBe(false);
    expect(result.current.errorMessage).toMatch(/at least 5/i);
    expect(result.current.showError).toBe(true);

    act(() => result.current.setValue("AG12345"));
    expect(result.current.canContinue).toBe(true);
    expect(result.current.errorMessage).toBe("");
    expect(result.current.showError).toBe(false);
  });

  it("does not show error for empty input until blur", () => {
    const { result } = renderHook(() => useRecipientField("phone"));
    expect(result.current.showError).toBe(false);
    act(() => result.current.onBlur());
    // Still empty after blur — empty inputs never get an inline error message.
    expect(result.current.errorMessage).toBe("");
    expect(result.current.showError).toBe(false);
  });

  it("phone: normalizes formatted input and gates Continue", () => {
    const { result } = renderHook(() => useRecipientField("phone"));
    act(() => result.current.setValue("0171-234-567"));
    expect(result.current.canContinue).toBe(false);
    act(() => result.current.setValue("0171-234-5678"));
    expect(result.current.canContinue).toBe(true);
    expect(result.current.normalized).toBe("01712345678");
  });

  it("phone: rejects numbers not starting with 01", () => {
    const { result } = renderHook(() => useRecipientField("phone"));
    act(() => result.current.setValue("02123456789"));
    expect(result.current.canContinue).toBe(false);
    expect(result.current.errorMessage).toMatch(/start with 01/i);
  });

  it("billAccount: passes label into the error message", () => {
    const { result } = renderHook(() =>
      useRecipientField("billAccount", "", "Meter No")
    );
    act(() => result.current.setValue("12"));
    expect(result.current.errorMessage).toContain("Meter No");
    expect(result.current.canContinue).toBe(false);
    act(() => result.current.setValue("1234"));
    expect(result.current.canContinue).toBe(true);
  });

  it("demoService (template): enforces 6–12 digit bounds", () => {
    const { result } = renderHook(() => useRecipientField("demoService"));
    act(() => result.current.setValue("12345"));
    expect(result.current.canContinue).toBe(false);
    act(() => result.current.setValue("123456"));
    expect(result.current.canContinue).toBe(true);
    act(() => result.current.setValue("1234567890123"));
    expect(result.current.canContinue).toBe(false);
  });
});
