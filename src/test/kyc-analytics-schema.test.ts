import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateKycAnalytics,
  assertKycAnalyticsSchema,
  KycAnalyticsSchemaError,
} from "@/lib/kycAnalyticsSchema";

/**
 * Unit coverage for the kycAnalytics runtime schema validator.
 *
 * Focus areas:
 *   1. Missing nested fields (e.g. `confidences.father`).
 *   2. Wrong data types on top-level and nested fields.
 *   3. Unknown extra top-level fields on strict-shape OCR events.
 *   4. Assertion behavior in non-strict vs. strict windows.
 */

type Payload = Parameters<typeof validateKycAnalytics>[1];

describe("validateKycAnalytics — missing nested fields", () => {
  it("reports each missing confidences.* field on kyc_ocr_run_end (success)", () => {
    const reasons = validateKycAnalytics("kyc_ocr_run_end", {
      side: "front",
      status: "success",
      duration_ms: 42,
      confidences: { bn_name: "high" } as Payload["confidences"], // father + mother missing
    });
    expect(reasons).toContain("confidences.father is required");
    expect(reasons).toContain("confidences.mother is required");
    expect(reasons).not.toContain("confidences.bn_name is required");
  });

  it("reports confidences must be an object when it's missing entirely", () => {
    const reasons = validateKycAnalytics("kyc_ocr_run_end", {
      side: "front",
      status: "success",
      duration_ms: 0,
    });
    expect(reasons).toContain("confidences must be an object");
  });

  it("does NOT require confidences when status is error", () => {
    const reasons = validateKycAnalytics("kyc_ocr_run_end", {
      side: "front",
      status: "error",
      duration_ms: 12,
      error: "boom",
    });
    expect(reasons).toEqual([]);
  });

  it("reports missing field/level on kyc_ocr_confidence", () => {
    const reasons = validateKycAnalytics("kyc_ocr_confidence", {
      side: "front",
    });
    expect(reasons).toEqual(
      expect.arrayContaining([
        "field is required",
        expect.stringMatching(/^level must be one of/),
      ]),
    );
  });
});

describe("validateKycAnalytics — wrong data types", () => {
  it("rejects non-enum side values", () => {
    const reasons = validateKycAnalytics("kyc_ocr_rescan_cancelled", {
      side: "diagonal" as unknown as "front",
    });
    expect(reasons.some((r) => r.startsWith("side must be one of"))).toBe(true);
  });

  it("rejects string duration_ms and negative duration_ms", () => {
    const stringDur = validateKycAnalytics("kyc_ocr_run_end", {
      side: "front",
      status: "success",
      duration_ms: "42" as unknown as number,
      confidences: { bn_name: "high", father: "high", mother: "high" },
    });
    expect(stringDur).toContain("duration_ms must be a finite number >= 0");

    const negDur = validateKycAnalytics("kyc_ocr_run_end", {
      side: "front",
      status: "success",
      duration_ms: -1,
      confidences: { bn_name: "high", father: "high", mother: "high" },
    });
    expect(negDur).toContain("duration_ms must be a finite number >= 0");
  });

  it("rejects a non-boolean/false reset on rescan_confirmed", () => {
    const reasonsFalse = validateKycAnalytics("kyc_ocr_rescan_confirmed", {
      side: "front",
      reset: false,
    });
    expect(reasonsFalse).toContain("reset must be literal true");

    const reasonsStr = validateKycAnalytics("kyc_ocr_rescan_confirmed", {
      side: "front",
      reset: "yes" as unknown as true,
    });
    expect(reasonsStr).toContain("reset must be literal true");
  });

  it("rejects non-numeric confidences.* values", () => {
    const reasons = validateKycAnalytics("kyc_ocr_run_end", {
      side: "front",
      status: "success",
      duration_ms: 5,
      confidences: {
        bn_name: "very high" as unknown as "high",
        father: 3 as unknown as "high",
        mother: "high",
      },
    });
    expect(reasons.filter((r) => r.startsWith("confidences."))).toHaveLength(2);
    expect(reasons.some((r) => r.includes("bn_name") && r.includes("very high"))).toBe(true);
    expect(reasons.some((r) => r.includes("father") && r.includes("3"))).toBe(true);
  });

  it("rejects sampled_count that is a string or below 1", () => {
    const zero = validateKycAnalytics("kyc_ocr_confidence", {
      side: "front",
      field: "father",
      level: "medium",
      sampled_count: 0,
    });
    expect(zero).toContain("sampled_count, when present, must be a finite number >= 1");

    const str = validateKycAnalytics("kyc_ocr_confidence", {
      side: "front",
      field: "father",
      level: "medium",
      sampled_count: "5" as unknown as number,
    });
    expect(str).toContain("sampled_count, when present, must be a finite number >= 1");
  });

  it("rejects sheet_populated with non-numeric or negative counts", () => {
    const reasons = validateKycAnalytics("kyc_sheet_populated", {
      total: "10" as unknown as number,
      verified: -2,
    });
    expect(reasons).toContain("total must be a finite number >= 0");
    expect(reasons).toContain("verified must be a finite number >= 0 when present");
  });

  it("rejects sheet_realtime with unknown event_type", () => {
    const reasons = validateKycAnalytics("kyc_sheet_realtime", {
      event_type: "UPSERT" as unknown as "INSERT",
    });
    expect(reasons.some((r) => r.startsWith("event_type must be one of"))).toBe(true);
  });
});

describe("validateKycAnalytics — unknown extra fields", () => {
  it("flags each unknown extra top-level key on kyc_ocr_run_end", () => {
    const reasons = validateKycAnalytics("kyc_ocr_run_end", {
      side: "front",
      status: "success",
      duration_ms: 10,
      confidences: { bn_name: "high", father: "high", mother: "high" },
      // Unknown extras below:
      user_id: "u_123",
      trace: { span: "abc" },
    } as Payload);
    expect(reasons).toContain("unknown field: user_id");
    expect(reasons).toContain("unknown field: trace");
  });

  it("flags unknown fields on kyc_ocr_confidence", () => {
    const reasons = validateKycAnalytics("kyc_ocr_confidence", {
      side: "front",
      field: "father",
      level: "high",
      confidence: 0.9, // not part of the schema; only `level` is
    } as Payload);
    expect(reasons).toContain("unknown field: confidence");
  });

  it("permits open-shape payloads on kyc_sheet_* events (no unknown-field rule)", () => {
    const reasons = validateKycAnalytics("kyc_sheet_populated", {
      total: 3,
      verified: 1,
      pending: 1,
      rejected: 1,
      // Ad-hoc extras allowed on sheet events:
      custom_dimension: "x",
      viewport: { w: 390 },
    } as Payload);
    expect(reasons).toEqual([]);
  });

  it("does not flag known optional fields as unknown", () => {
    const reasons = validateKycAnalytics("kyc_ocr_run_end", {
      side: "front",
      status: "error",
      duration_ms: 5,
      error: "network",
    });
    expect(reasons).toEqual([]);
  });

  it("rejects unknown events entirely and skips unknown-field checks", () => {
    const reasons = validateKycAnalytics(
      "kyc_ocr_totally_made_up" as unknown as "kyc_ocr_run_start",
      { side: "front", extra: 1 } as Payload,
    );
    expect(reasons).toEqual(["unknown event: kyc_ocr_totally_made_up"]);
  });
});

describe("validateKycAnalytics — happy paths remain clean", () => {
  it.each([
    ["kyc_ocr_rescan_confirmed", { side: "front", reset: true }],
    ["kyc_ocr_rescan_cancelled", { side: "front" }],
    ["kyc_ocr_run_start", { side: "front" }],
    [
      "kyc_ocr_run_end",
      {
        side: "front",
        status: "success",
        duration_ms: 123,
        confidences: { bn_name: "high", father: "medium", mother: "low" },
      },
    ],
    [
      "kyc_ocr_confidence",
      { side: "front", field: "father", level: "high", sampled_count: 3 },
    ],
    ["kyc_sheet_populated", { total: 3, verified: 1, pending: 1, rejected: 1 }],
    ["kyc_sheet_error", { error: "network" }],
    ["kyc_sheet_long_reason", { reason_length: 240 }],
    ["kyc_sheet_realtime", { event_type: "UPDATE" }],
  ] as Array<[Parameters<typeof validateKycAnalytics>[0], Payload]>)(
    "returns no reasons for a valid %s payload",
    (event, payload) => {
      expect(validateKycAnalytics(event, payload)).toEqual([]);
    },
  );
});

describe("assertKycAnalyticsSchema — window integration", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    (window as unknown as { __kycAnalyticsSchemaErrors?: unknown[] })
      .__kycAnalyticsSchemaErrors = [];
    (window as unknown as { __kycAnalyticsStrict?: boolean }).__kycAnalyticsStrict = false;
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    delete (window as unknown as { __kycAnalyticsSchemaErrors?: unknown[] })
      .__kycAnalyticsSchemaErrors;
    delete (window as unknown as { __kycAnalyticsStrict?: boolean }).__kycAnalyticsStrict;
  });

  it("records violations on the window and does not throw in non-strict mode", () => {
    expect(() =>
      assertKycAnalyticsSchema("kyc_ocr_confidence", { side: "front" } as Payload),
    ).not.toThrow();

    const recorded = (
      window as unknown as {
        __kycAnalyticsSchemaErrors: Array<{ event: string; reasons: string[] }>;
      }
    ).__kycAnalyticsSchemaErrors;
    expect(recorded).toHaveLength(1);
    expect(recorded[0].event).toBe("kyc_ocr_confidence");
    expect(recorded[0].reasons.length).toBeGreaterThan(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("throws KycAnalyticsSchemaError with event + reasons in strict mode", () => {
    (window as unknown as { __kycAnalyticsStrict: boolean }).__kycAnalyticsStrict = true;
    let caught: unknown = null;
    try {
      assertKycAnalyticsSchema("kyc_ocr_run_end", {
        side: "sideways" as unknown as "front",
        status: "kinda" as unknown as "success",
        duration_ms: -1,
      } as Payload);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(KycAnalyticsSchemaError);
    const err = caught as KycAnalyticsSchemaError;
    expect(err.message).toContain("kyc_ocr_run_end");
    expect(err.message).toMatch(/side/);
    expect(err.message).toMatch(/status/);
    expect(err.message).toMatch(/duration_ms/);
    expect(err.violation.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it("is a no-op when the payload is valid", () => {
    expect(() =>
      assertKycAnalyticsSchema("kyc_ocr_rescan_confirmed", { side: "front", reset: true }),
    ).not.toThrow();
    const recorded = (
      window as unknown as { __kycAnalyticsSchemaErrors: unknown[] }
    ).__kycAnalyticsSchemaErrors;
    expect(recorded).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
