import { describe, it, expect } from "vitest";
import {
  pickFirstWithConfidence,
  pickFirstWithSiblingConfidence,
  computeFieldConfidence,
  resolveConfidence,
} from "@/lib/ocrConfidence";

describe("pickFirstWithConfidence", () => {
  it("returns plain string with null confidence", () => {
    expect(pickFirstWithConfidence("Tanvir")).toEqual({ value: "Tanvir", confidence: null });
  });

  it("extracts nested { value, confidence } shape", () => {
    expect(pickFirstWithConfidence({ value: "Karim", confidence: 0.92 })).toEqual({
      value: "Karim",
      confidence: 0.92,
    });
  });

  it("normalizes 0..100 confidence into 0..1", () => {
    const r = pickFirstWithConfidence({ value: "Karim", confidence: 87 });
    expect(r.value).toBe("Karim");
    expect(r.confidence).toBeCloseTo(0.87, 2);
  });

  it("accepts `score` / `probability` as alternate confidence keys", () => {
    expect(pickFirstWithConfidence({ value: "A", score: 0.7 }).confidence).toBe(0.7);
    expect(pickFirstWithConfidence({ value: "B", probability: "0.4" }).confidence).toBe(0.4);
  });

  it("falls through empty candidates", () => {
    expect(pickFirstWithConfidence(null, "", { value: "X", confidence: 0.5 })).toEqual({
      value: "X",
      confidence: 0.5,
    });
  });
});

describe("pickFirstWithSiblingConfidence", () => {
  it("uses sibling <key>_confidence when nested confidence is absent", () => {
    const root = { father_name: "Abdul Karim", father_name_confidence: 0.75 };
    expect(pickFirstWithSiblingConfidence(root, ["father_name", "father"])).toEqual({
      value: "Abdul Karim",
      confidence: 0.75,
    });
  });

  it("prefers nested confidence over sibling", () => {
    const root = {
      father_name: { value: "Abdul Karim", confidence: 0.95 },
      father_name_confidence: 0.4,
    };
    const r = pickFirstWithSiblingConfidence(root, ["father_name"]);
    expect(r.confidence).toBe(0.95);
  });
});

describe("computeFieldConfidence heuristic", () => {
  it("BN name: pure Bangla, 2+ words → high", () => {
    expect(computeFieldConfidence("name_bn", "তানভীর হাসান")).toBe("high");
  });
  it("BN name: mixed Latin+Bangla → medium", () => {
    expect(computeFieldConfidence("name_bn", "Tanvir হাসান")).toBe("medium");
  });
  it("BN name: no Bangla script → low", () => {
    expect(computeFieldConfidence("name_bn", "Tanvir")).toBe("low");
  });
  it("father with digits → low", () => {
    expect(computeFieldConfidence("father", "Abdul 1234")).toBe("low");
  });
  it("father with 2 words → high", () => {
    expect(computeFieldConfidence("father", "Abdul Karim")).toBe("high");
  });
  it("mother single short name → medium", () => {
    expect(computeFieldConfidence("mother", "Ayesha")).toBe("medium");
  });
  it("empty → none", () => {
    expect(computeFieldConfidence("father", "")).toBe("none");
  });
});

describe("resolveConfidence", () => {
  it("prefers explicit high score over weak heuristic", () => {
    expect(resolveConfidence("father", { value: "X", confidence: 0.9 })).toBe("high");
  });
  it("falls back to heuristic when no explicit score", () => {
    expect(resolveConfidence("name_bn", { value: "তানভীর হাসান", confidence: null })).toBe("high");
  });
  it("returns none for empty value regardless of score", () => {
    expect(resolveConfidence("father", { value: "", confidence: 0.99 })).toBe("none");
  });
});
