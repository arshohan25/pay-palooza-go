import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { translationsMap } from "@/lib/i18n";

// Batch 1-7 files that were localized. If a t("key") reference in one of these
// files does not resolve to translationsMap, the test fails — catching typos
// and forgotten dictionary entries before they ship.
const BATCH_FILES = [
  // Batch 1
  "src/pages/AddMoneyStatusPage.tsx",
  "src/pages/PaymentReturnPage.tsx",
  "src/pages/ForgotPinPage.tsx",
  "src/pages/CareersPage.tsx",
  // Batch 2
  "src/pages/AgentBillPay.tsx",
  "src/pages/AgentTransactionHistory.tsx",
  "src/pages/AgentLeaderboard.tsx",
  "src/pages/AgentSecurity.tsx",
  // Batch 3
  "src/pages/AgentAnalyticsPage.tsx",
  "src/pages/AgentStatement.tsx",
  "src/pages/AgentDisputes.tsx",
  "src/pages/AgentBankTransfer.tsx",
  "src/pages/AgentCashIn.tsx",
  "src/pages/AgentCashOut.tsx",
  "src/pages/AgentB2B.tsx",
  // Batch 4
  "src/pages/AgentDashboard.tsx",
  "src/components/agent/AvailabilityCard.tsx",
  "src/components/agent/FlagSuspiciousSheet.tsx",
  // Batch 5
  "src/pages/DistributorLoginPage.tsx",
  "src/pages/SuperDistributorLoginPage.tsx",
  // Batch 6
  "src/pages/MerchantManagerLoginPage.tsx",
  "src/pages/DistributorDashboard.tsx",
  "src/pages/SuperDistributorDashboard.tsx",
  // Batch 7
  "src/pages/DistributorCreateAgent.tsx",
  "src/pages/SuperDistributorCreateDistributor.tsx",
  "src/components/DistributorFloatRequests.tsx",
];

// Extract every t("…") / t('…') identifier from a source file.
function extractTKeys(source: string): string[] {
  const keys = new Set<string>();
  const re = /\bt\(\s*(["'])([A-Za-z_][A-Za-z0-9_]*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) keys.add(m[2]);
  return [...keys];
}

describe("i18n — Batch 1-7 key coverage", () => {
  it("translationsMap source has no duplicate top-level keys", () => {
    // TS object literals silently overwrite duplicate keys — scan the raw
    // source to catch human error before it ships.
    const src = readFileSync(resolve(__dirname, "../lib/i18n.tsx"), "utf8");
    const start = src.indexOf("const translations = {");
    expect(start, "translations dictionary not found").toBeGreaterThan(-1);

    // Walk the balanced braces of the dictionary literal.
    let depth = 0;
    let end = -1;
    for (let i = src.indexOf("{", start); i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);

    // Match only top-level `keyName: {` entries (depth === 1).
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    let d = 0;
    const lineRe = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{\s*en\s*:/g;
    // Track brace depth relative to `body` so nested `{ en: …, bn: … }` entries
    // don't get double-counted.
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === "{") d++;
      else if (c === "}") d--;
      else if (d === 1) {
        lineRe.lastIndex = i;
        const m = lineRe.exec(body);
        if (m && m.index === i) {
          const key = m[1];
          if (seen.has(key)) duplicates.push(key);
          else seen.set(key, i);
          i = lineRe.lastIndex - 1;
        }
      }
    }
    expect(duplicates, `duplicate i18n keys: ${duplicates.join(", ")}`).toEqual([]);
  });

  for (const file of BATCH_FILES) {
    it(`${file} references only registered translation keys`, () => {
      const src = readFileSync(resolve(__dirname, "../..", file), "utf8");
      const keys = extractTKeys(src);
      const missing = keys.filter((k) => !(k in translationsMap));
      expect(
        missing,
        `${file} uses undefined i18n keys: ${missing.join(", ")}`,
      ).toEqual([]);
    });
  }
});
