import { describe, it, expect } from "vitest";
import { bnCategoryLabel } from "./merchantCategoryBn";

/**
 * Contract tests for the Bangla category label mapping.
 *
 *  - Every mapped key resolves to a non-empty Bangla string (U+0980..U+09FF).
 *  - Resolution is deterministic (same input → same output).
 *  - Unknown / empty names fall back to the provided English label.
 *  - Bangla substring search (as used by MerchantApplicationFlow.filteredCats)
 *    matches expected keys — so users typing Bangla in the search box see
 *    the right options.
 */

// Spot-check pairs: each entry is [db name, Bangla substring the user might type,
// expected label the search should surface].
const SEARCH_CASES: Array<[string, string, string]> = [
  ["food", "খাদ্য", "খাদ্য ও পানীয়"],
  ["restaurant", "রেস্টুরেন্ট", "রেস্টুরেন্ট"],
  ["pharmacy", "ফার্মেসি", "ফার্মেসি"],
  ["grocery", "মুদি", "মুদি"],
  ["electronics", "ইলেকট্রনিক্স", "ইলেকট্রনিক্স"],
  ["fashion", "ফ্যাশন", "ফ্যাশন ও পোশাক"],
  ["education", "শিক্ষা", "শিক্ষা"],
  ["healthcare", "স্বাস্থ্য", "স্বাস্থ্যসেবা"],
  ["mobile_recharge", "রিচার্জ", "মোবাইল রিচার্জ"],
  ["other", "অন্যান্য", "অন্যান্য"],
];

// Full list of DB category `name`s in public.merchant_categories the mapping
// must cover. Keep in sync with the seed migration.
const REQUIRED_KEYS = [
  "accounting","agriculture","airline","amusement_park","architecture","art_gallery",
  "automotive","ayurveda","baby_products","bakery","beauty","beverage","bookshop",
  "cable_tv","car_rental","catering","charity","cinema","cleaning_services",
  "cloud_hosting","cloud_kitchen","club","coaching","college","construction",
  "consulting","cooperative","cosmetics","courier","customs_clearing","cybersecurity",
  "dairy","data_analytics","dental","diagnostic","driving_school","ecommerce",
  "education","electrical_services","electricity","electronics","engineering",
  "entertainment","event_management","eye_care","farm_equipment","fashion","fintech",
  "fishing","food","freight","furniture","gaming","gardening","gas_station",
  "gift_shop","government","grocery","gym","handicraft","hardware","healthcare",
  "home_repair","hospital","hostel","hotel","import_export","insurance",
  "interior_design","isp","it_services","jewelry","language_school","laundry",
  "leather","legal","logistics","manufacturing","marketing","meat_fish","media",
  "medical_equipment","mental_health","microfinance","mining","mobile_app",
  "mobile_operator","moving_services","museum","music","ngo","online_learning",
  "organic_food","other","painting","pest_control","pet_care","pharmacy",
  "photography","physiotherapy","plumbing","poultry","printing","real_estate",
  "real_estate_agent","recycling","religious","remittance","restaurant","retail",
  "ride_sharing","salon","school","security_services","seeds_fertilizer","services",
  "shipping","solar_energy","spa","sports","stationery","stock_broker","street_food",
  "supermarket","swimming","tea_coffee","telecom","textile","tour_operator","toys",
  "training_institute","transportation","travel","travel_agency","warehouse",
  "waste_management","water_supply","web_development","wedding_services","wholesale",
  "yoga",
];

const BN_RE = /[\u0980-\u09FF]/;

describe("bnCategoryLabel — mapping contract", () => {
  it.each(REQUIRED_KEYS)("has a non-empty Bangla translation for %s", (key) => {
    const out = bnCategoryLabel(key, "__fallback__");
    expect(out, `no mapping for ${key}`).not.toBe("__fallback__");
    expect(out.trim().length).toBeGreaterThan(0);
    expect(out, `${key} → ${out} contains no Bangla`).toMatch(BN_RE);
  });

  it("is deterministic — same input always produces the same output", () => {
    for (const k of REQUIRED_KEYS) {
      const a = bnCategoryLabel(k, "x");
      const b = bnCategoryLabel(k, "y");
      expect(a).toBe(b);
    }
  });

  it("falls back to the English label when name is null / undefined / empty", () => {
    expect(bnCategoryLabel(null, "Retail")).toBe("Retail");
    expect(bnCategoryLabel(undefined, "Retail")).toBe("Retail");
    expect(bnCategoryLabel("", "Retail")).toBe("Retail");
  });

  it("falls back to the English label for unknown category names", () => {
    expect(bnCategoryLabel("nonexistent_category", "Custom")).toBe("Custom");
    expect(bnCategoryLabel("FOOD", "Food")).toBe("Food"); // case sensitive
  });

  it("saloon and salon both resolve to the same Bangla label", () => {
    expect(bnCategoryLabel("saloon", "?")).toBe(bnCategoryLabel("salon", "?"));
  });
});

describe("bnCategoryLabel — Bangla search parity with MerchantApplicationFlow", () => {
  it.each(SEARCH_CASES)(
    "searching %s in Bangla (%s) matches its Bangla label (%s)",
    (name, query, expected) => {
      const label = bnCategoryLabel(name, "__fallback__");
      expect(label).toBe(expected);
      // Mirrors the filter logic in MerchantApplicationFlow.filteredCats.
      expect(label.toLowerCase().includes(query.toLowerCase())).toBe(true);
    },
  );

  it("no two db names collide onto Bangla labels that would break the search intent", () => {
    // Non-goal: force every label unique (saloon/salon intentionally share one).
    // Goal: every distinct Bangla label maps back to a real English key.
    const seen = new Map<string, string[]>();
    for (const k of REQUIRED_KEYS) {
      const bn = bnCategoryLabel(k, "");
      if (!seen.has(bn)) seen.set(bn, []);
      seen.get(bn)!.push(k);
    }
    const collisions = [...seen.entries()].filter(([, keys]) => keys.length > 1);
    // Only the saloon/salon pair is allowed.
    for (const [bn, keys] of collisions) {
      expect(
        keys.sort(),
        `unexpected Bangla-label collision for "${bn}": ${keys.join(",")}`,
      ).toEqual(["salon", "saloon"]);
    }
  });
});
