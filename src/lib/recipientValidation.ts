/**
 * Centralized recipient ID / number format rules.
 *
 * Every money-movement flow that asks the user for a recipient identifier
 * (phone, agent ID, merchant ID, bill account, bank account, etc.) should
 * pull its rule from here so the format, minimum length, and inline error
 * message stay consistent across the whole app.
 *
 * Add a new entry when introducing a new flow — never inline `length < N`
 * checks or hand-written error strings in components.
 */

import { z } from "zod";

export type RecipientKind =
  | "phone"          // 11-digit BD mobile, starts with 01
  | "agentId"        // Cash-out agent ID
  | "merchantId"     // Merchant payment ID
  | "billAccount"    // Utility / bill pay account no.
  | "bankAccount"    // Bank account number
  | "accountHolder"  // Account holder name
  | "demoService";   // Example template — copy this entry when adding a new flow

interface RecipientRule {
  /** Minimum acceptable length after trim() / digit-strip. */
  min: number;
  /** Optional maximum (used by phone). */
  max?: number;
  /** Strip non-digits before measuring length (phone, bank account, bill). */
  digitsOnly?: boolean;
  /** Message shown inline while the value is non-empty but invalid. */
  emptyOrShortMessage: (label?: string) => string;
  /** Extra predicate (e.g. phone must start with "01"). */
  extra?: (value: string) => string | null;
}

const RULES: Record<RecipientKind, RecipientRule> = {
  phone: {
    min: 11,
    max: 11,
    digitsOnly: true,
    emptyOrShortMessage: () => "Enter an 11-digit mobile number.",
    extra: (v) => {
      const digits = v.replace(/\D/g, "");
      if (digits.length > 2 && !digits.startsWith("01")) return "Number must start with 01.";
      return null;
    },
  },
  agentId: {
    min: 5,
    emptyOrShortMessage: () => "Agent ID must be at least 5 characters.",
  },
  merchantId: {
    min: 5,
    emptyOrShortMessage: () => "Merchant ID must be at least 5 characters.",
  },
  billAccount: {
    min: 4,
    digitsOnly: false,
    emptyOrShortMessage: (label) => `${label ?? "Account"} must be at least 4 digits.`,
  },
  bankAccount: {
    min: 8,
    digitsOnly: true,
    emptyOrShortMessage: () => "Account number must be at least 8 digits.",
  },
  accountHolder: {
    min: 2,
    emptyOrShortMessage: () => "Enter the account holder's name.",
  },
};

export interface RecipientCheck {
  /** True if the value meets the rule and any extra predicate. */
  isValid: boolean;
  /** Inline error message to show (empty string when nothing to show). */
  errorMessage: string;
  /** Whether the input is empty (after trim). */
  isEmpty: boolean;
  /** Normalized value (trimmed; digits-only if applicable). */
  normalized: string;
}

/**
 * Validate a recipient value against a centralized rule.
 *
 * Inline error is suppressed for empty input so the user sees a clean
 * field until they start typing.
 */
export function validateRecipient(
  kind: RecipientKind,
  value: string,
  label?: string
): RecipientCheck {
  const rule = RULES[kind];
  const trimmed = value.trim();
  const normalized = rule.digitsOnly ? trimmed.replace(/\D/g, "") : trimmed;
  const isEmpty = normalized.length === 0;

  if (isEmpty) {
    return { isValid: false, errorMessage: "", isEmpty: true, normalized };
  }

  const extraError = rule.extra?.(value) ?? null;
  if (extraError) {
    return { isValid: false, errorMessage: extraError, isEmpty: false, normalized };
  }

  if (normalized.length < rule.min) {
    return {
      isValid: false,
      errorMessage: rule.emptyOrShortMessage(label),
      isEmpty: false,
      normalized,
    };
  }
  if (rule.max && normalized.length > rule.max) {
    return {
      isValid: false,
      errorMessage: rule.emptyOrShortMessage(label),
      isEmpty: false,
      normalized,
    };
  }
  return { isValid: true, errorMessage: "", isEmpty: false, normalized };
}

/** Zod schema factory if a flow prefers schema-based validation. */
export const recipientSchema = (kind: RecipientKind, label?: string) =>
  z.string().superRefine((v, ctx) => {
    const r = validateRecipient(kind, v, label);
    if (!r.isValid && !r.isEmpty) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.errorMessage });
    } else if (r.isEmpty) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required" });
    }
  });
