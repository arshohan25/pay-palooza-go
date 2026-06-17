import { describe, it, expect } from "vitest";
import { validateRecipient } from "./recipientValidation";

describe("recipientValidation", () => {
  describe("phone", () => {
    it("accepts a valid 11-digit number starting with 01", () => {
      const r = validateRecipient("phone", "01712345678");
      expect(r.isValid).toBe(true);
      expect(r.errorMessage).toBe("");
      expect(r.normalized).toBe("01712345678");
    });

    it("ignores formatting characters", () => {
      expect(validateRecipient("phone", "0171-234-5678").isValid).toBe(true);
    });

    it("rejects numbers not starting with 01", () => {
      const r = validateRecipient("phone", "0212345678");
      expect(r.isValid).toBe(false);
      expect(r.errorMessage).toMatch(/start with 01/i);
    });

    it("rejects short numbers", () => {
      const r = validateRecipient("phone", "017123");
      expect(r.isValid).toBe(false);
      expect(r.errorMessage).toMatch(/11-digit/i);
    });

    it("returns empty (no error) for empty input", () => {
      const r = validateRecipient("phone", "");
      expect(r.isEmpty).toBe(true);
      expect(r.errorMessage).toBe("");
    });
  });

  describe("agentId", () => {
    it("accepts >= 5 chars", () => {
      expect(validateRecipient("agentId", "AG123").isValid).toBe(true);
    });
    it("rejects < 5 chars", () => {
      expect(validateRecipient("agentId", "AG1").isValid).toBe(false);
    });
  });

  describe("merchantId", () => {
    it("accepts >= 5 chars", () => {
      expect(validateRecipient("merchantId", "MERCH1").isValid).toBe(true);
    });
    it("rejects < 5 chars", () => {
      const r = validateRecipient("merchantId", "M1");
      expect(r.isValid).toBe(false);
      expect(r.errorMessage).toMatch(/merchant id/i);
    });
  });

  describe("billAccount", () => {
    it("accepts >= 4 chars and uses custom label", () => {
      expect(validateRecipient("billAccount", "1234", "Meter No").isValid).toBe(true);
    });
    it("uses label in error", () => {
      const r = validateRecipient("billAccount", "12", "Meter No");
      expect(r.errorMessage).toContain("Meter No");
    });
  });

  describe("bankAccount", () => {
    it("accepts >= 8 digits (formatting stripped)", () => {
      expect(validateRecipient("bankAccount", "1234-5678").isValid).toBe(true);
    });
    it("rejects < 8 digits", () => {
      expect(validateRecipient("bankAccount", "12345").isValid).toBe(false);
    });
  });

  describe("accountHolder", () => {
    it("accepts a 2+ char name", () => {
      expect(validateRecipient("accountHolder", "Ali").isValid).toBe(true);
    });
    it("rejects a 1-char name", () => {
      expect(validateRecipient("accountHolder", "A").isValid).toBe(false);
    });
  });

  describe("demoService (example template)", () => {
    it("accepts a 6–12 digit ID", () => {
      expect(validateRecipient("demoService", "123456").isValid).toBe(true);
      expect(validateRecipient("demoService", "123456789012").isValid).toBe(true);
    });
    it("rejects too short", () => {
      expect(validateRecipient("demoService", "12345").isValid).toBe(false);
    });
    it("rejects too long", () => {
      expect(validateRecipient("demoService", "1234567890123").isValid).toBe(false);
    });
  });
});
