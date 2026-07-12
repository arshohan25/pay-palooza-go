import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOtpLockout, parseLockout } from "@/hooks/use-otp-lockout";

describe("useOtpLockout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts unlocked", () => {
    const { result } = renderHook(() => useOtpLockout("pin_reset:01700000000"));
    expect(result.current.isLocked).toBe(false);
    expect(result.current.remainingSec).toBe(0);
  });

  it("locks for the requested number of minutes and persists", () => {
    const key = "pin_reset:01700000000";
    const { result } = renderHook(() => useOtpLockout(key));

    act(() => result.current.lock(15, "Too many failed attempts. Try again in 15 minutes."));

    expect(result.current.isLocked).toBe(true);
    expect(result.current.remainingMin).toBe(15);
    expect(result.current.message).toMatch(/15 minutes/);

    const raw = localStorage.getItem(`otp_lockout:${key}`);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!);
    expect(stored.until).toBeGreaterThan(Date.now());
  });

  it("rehydrates lockout across mount (simulating page refresh)", () => {
    const key = "pin_reset:01700000000";
    localStorage.setItem(
      `otp_lockout:${key}`,
      JSON.stringify({ until: Date.now() + 5 * 60 * 1000, message: "Locked" }),
    );
    const { result } = renderHook(() => useOtpLockout(key));
    expect(result.current.isLocked).toBe(true);
    expect(result.current.remainingMin).toBeGreaterThan(0);
  });

  it("auto-clears when the timer expires", () => {
    const key = "pin_reset:01700000000";
    const { result } = renderHook(() => useOtpLockout(key));
    act(() => result.current.lock(1));
    expect(result.current.isLocked).toBe(true);

    act(() => { vi.advanceTimersByTime(61 * 1000); });

    expect(result.current.isLocked).toBe(false);
    expect(localStorage.getItem(`otp_lockout:${key}`)).toBeNull();
  });

  it("clear() removes lockout immediately", () => {
    const key = "pin_reset:01700000000";
    const { result } = renderHook(() => useOtpLockout(key));
    act(() => result.current.lock(5));
    expect(result.current.isLocked).toBe(true);
    act(() => result.current.clear());
    expect(result.current.isLocked).toBe(false);
    expect(localStorage.getItem(`otp_lockout:${key}`)).toBeNull();
  });
});

describe("parseLockout", () => {
  it("returns null on a normal response", async () => {
    const res = await parseLockout({ verified: false, error: "Incorrect code" }, null);
    expect(res).toBeNull();
  });

  it("reads locked=true from response body", async () => {
    const res = await parseLockout(
      { locked: true, retry_after_minutes: 15, error: "Too many failed attempts. Try again in 15 minutes." },
      null,
    );
    expect(res).not.toBeNull();
    expect(res!.minutes).toBe(15);
    expect(res!.message).toMatch(/15 minutes/);
  });

  it("reads locked=true from HTTP error context (429 body)", async () => {
    const err: any = {
      context: {
        json: async () => ({
          locked: true,
          retry_after_minutes: 20,
          error: "Too many failed attempts. Try again in 20 minutes.",
        }),
      },
    };
    const res = await parseLockout(null, err);
    expect(res).not.toBeNull();
    expect(res!.minutes).toBe(20);
  });

  it("defaults to 15 minutes when retry_after_minutes is missing", async () => {
    const res = await parseLockout({ locked: true }, null);
    expect(res!.minutes).toBe(15);
  });
});
