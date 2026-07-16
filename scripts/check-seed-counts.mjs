#!/usr/bin/env node
/**
 * Seed integrity check — verifies that reference data required by the
 * merchant / agent / distributor flows is fully populated.
 *
 * Usage:
 *   node scripts/check-seed-counts.mjs
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from process.env
 * (falls back to values in .env). Exits non-zero on any shortfall so CI can
 * fail early if a migration regresses.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* .env is optional */
  }
}
loadEnv();

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) {
  console.error("✗ Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(2);
}

/** Fetch exact row count using PostgREST's Prefer: count=exact + HEAD. */
async function count(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method: "HEAD",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`${path} → ${res.status} ${res.statusText}`);
  }
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  if (!Number.isFinite(total)) throw new Error(`No count for ${path}: "${range}"`);
  return total;
}

const EXPECTED = {
  "merchant_categories?is_active=eq.true": { min: 20, label: "Active merchant categories" },
  "unions?type=eq.city_corporation": { min: 12, label: "City corporations" },
  "unions?type=eq.powrashava": { min: 600, label: "Powrashavas" },
  "unions?type=eq.union": { min: 4500, label: "Union parishads" },
  "unions": { min: 5000, label: "Total unions rows" },
};

let failed = 0;
console.log("Seed integrity check\n────────────────────");
for (const [q, { min, label }] of Object.entries(EXPECTED)) {
  try {
    const n = await count(`${q}${q.includes("?") ? "&" : "?"}select=id`);
    const ok = n >= min;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${label.padEnd(28)} ${String(n).padStart(6)}   (expected ≥ ${min})`);
  } catch (err) {
    failed++;
    console.log(`✗ ${label.padEnd(28)}   ERROR   ${err.message}`);
  }
}
console.log("────────────────────");
if (failed) {
  console.error(`FAILED: ${failed} check(s) below threshold`);
  process.exit(1);
}
console.log("All seed counts healthy.");
