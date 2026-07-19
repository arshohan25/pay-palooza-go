import { describe, it, expect } from "vitest";
import { pickFirstString } from "@/lib/ocrPickFirst";

describe("pickFirstString", () => {
  it("returns the first non-empty trimmed string", () => {
    expect(pickFirstString(undefined, "", "  Tanvir  ", "ignored")).toBe("Tanvir");
  });

  it("skips null/undefined and literal 'null' / 'n/a' strings", () => {
    expect(pickFirstString(null, undefined, "null", "N/A", "Rahim")).toBe("Rahim");
  });

  it("coerces numeric values to strings (e.g. NID number returned as number)", () => {
    expect(pickFirstString(undefined, 19901234567890)).toBe("19901234567890");
  });

  it("coerces bigint values to strings", () => {
    expect(pickFirstString(undefined, 12345678901234n)).toBe("12345678901234");
  });

  it("unwraps nested { value } objects", () => {
    expect(pickFirstString({ value: "  Karim  " })).toBe("Karim");
  });

  it("unwraps numeric { value } objects", () => {
    expect(pickFirstString({ value: 42 })).toBe("42");
  });

  it("formats DOB shaped as { day, month, year } into DD/MM/YYYY", () => {
    expect(pickFirstString({ day: 1, month: 2, year: 1990 })).toBe("01/02/1990");
  });

  it("pads single-digit day/month in nested DOB objects", () => {
    expect(pickFirstString({ day: "5", month: "9", year: "2001" })).toBe("05/09/2001");
  });

  it("falls through nested objects that don't match expected shapes", () => {
    expect(pickFirstString({ foo: "bar" }, "fallback")).toBe("fallback");
  });

  it("returns empty string when no candidate is usable", () => {
    expect(pickFirstString(null, undefined, "", "   ", "null")).toBe("");
  });

  it("prefers earlier candidates over later ones", () => {
    expect(pickFirstString("first", "second", 3)).toBe("first");
  });

  it("handles mixed real-world OCR shape (father name as nested value, mother as string)", () => {
    const ocr = {
      father_name: { value: "Abdul Karim" },
      mother_name: "Fatema Begum",
    };
    expect(pickFirstString(ocr.father_name)).toBe("Abdul Karim");
    expect(pickFirstString(ocr.mother_name)).toBe("Fatema Begum");
  });
});
