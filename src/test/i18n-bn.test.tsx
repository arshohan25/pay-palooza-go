import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import {
  I18nProvider,
  useI18n,
  translationsMap,
  getMissingTranslationKeys,
  resetMissingTranslationKeys,
  type TranslationKey,
} from "@/lib/i18n";

// Small probe component
function Probe({ keys }: { keys: TranslationKey[] }) {
  const { t, lang, toggleLang } = useI18n();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <button onClick={toggleLang}>toggle</button>
      <ul>
        {keys.map((k) => (
          <li key={k} data-testid={`k-${k}`}>{t(k)}</li>
        ))}
      </ul>
    </div>
  );
}

// Heading / tab / button keys used across the main user-facing routes.
// Each route must have its primary headings translated to Bangla.
const ROUTE_KEYS: Record<string, TranslationKey[]> = {
  "/ (home)": ["welcomeBack", "availableBalance", "sendMoney", "cashOut", "recharge", "payBill", "shop"],
  "/account": ["editProfile", "kycVerification", "changePin", "spendingInsights", "signOut"],
  "/savings": ["recentTransactions"],
  "/donations": ["donations", "chooseCause"],
  "/coupons": ["noCouponsYet", "redeem"],
  "/pay (not-found)": ["merchantNotFound", "loadingPayment"],
};

const BANGLA = /[\u0980-\u09FF]/;

describe("i18n — Bangla coverage on key routes", () => {
  beforeEach(() => {
    localStorage.setItem("mfs_ui_lang", "bn");
    resetMissingTranslationKeys();
  });
  afterEach(() => {
    cleanup();
    localStorage.removeItem("mfs_ui_lang");
  });

  for (const [route, keys] of Object.entries(ROUTE_KEYS)) {
    it(`renders Bangla for ${route}`, () => {
      render(
        <I18nProvider>
          <Probe keys={keys} />
        </I18nProvider>
      );
      expect(screen.getByTestId("lang").textContent).toBe("bn");
      for (const k of keys) {
        const text = screen.getByTestId(`k-${k}`).textContent ?? "";
        expect(text, `expected Bangla text for "${k}"`).toMatch(BANGLA);
        expect(text, `"${k}" must not show missing-key fallback`).not.toMatch(/^⟦.*⟧$/);
      }
    });
  }

  it("toggles from en → bn and content changes", () => {
    localStorage.setItem("mfs_ui_lang", "en");
    render(
      <I18nProvider>
        <Probe keys={["signOut", "sendMoney"]} />
      </I18nProvider>
    );
    const before = screen.getByTestId("k-signOut").textContent;
    expect(before).toBe("Sign Out");
    act(() => {
      screen.getByText("toggle").click();
    });
    const after = screen.getByTestId("k-signOut").textContent;
    expect(after).toMatch(BANGLA);
    expect(after).not.toBe(before);
  });
});

describe("i18n — translation table integrity", () => {
  it("every key has both en and bn entries", () => {
    const broken: string[] = [];
    for (const [key, entry] of Object.entries(translationsMap)) {
      const e = entry as { en?: string; bn?: string };
      if (!e.en || !e.en.trim()) broken.push(`${key}: missing en`);
      if (!e.bn || !e.bn.trim()) broken.push(`${key}: missing bn`);
    }
    expect(broken, broken.join("\n")).toEqual([]);
  });

  it("bn values for non-symbol keys actually contain Bangla characters", () => {
    // Allow a small allowlist of intentionally non-Bangla bn values (e.g. brand or toggle label).
    const allowNonBangla = new Set<string>(["langToggle"]); // "English" in bn mode
    const offenders: string[] = [];
    for (const [key, entry] of Object.entries(translationsMap)) {
      if (allowNonBangla.has(key)) continue;
      const bn = (entry as { bn: string }).bn;
      if (!BANGLA.test(bn)) offenders.push(`${key} -> "${bn}"`);
    }
    expect(offenders, `keys missing Bangla characters:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("i18n — missing translation detector", () => {
  beforeEach(() => resetMissingTranslationKeys());

  it("returns a clear UI fallback and records the missing key", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    function Bad() {
      const { t } = useI18n();
      // @ts-expect-error — purposely unknown key
      return <div data-testid="bad">{t("__definitely_missing_key__")}</div>;
    }
    render(
      <I18nProvider>
        <Bad />
      </I18nProvider>
    );
    expect(screen.getByTestId("bad").textContent).toBe("⟦__definitely_missing_key__⟧");
    expect(getMissingTranslationKeys().some((k) => k.startsWith("__definitely_missing_key__"))).toBe(true);
    warn.mockRestore();
  });
});
