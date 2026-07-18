#!/usr/bin/env node
/**
 * strip-to-role.mjs
 * -----------------------------------------------------------------------------
 * Run inside a REMIX of the main EasyPay project to convert it into a
 * single-role PWA (agent / merchant / distributor / super-distributor / admin).
 *
 * What it does — safe, idempotent, and reversible via git:
 *   1. Rewrites public/manifest.json to the chosen role (scope "/", start_url "/")
 *      using the matching public/manifest-<role>.json as source of truth.
 *   2. Removes the other role manifests from public/ (they're not needed on a
 *      per-role subdomain).
 *   3. Patches index.html <title>, description, theme-color, and <link rel="manifest">
 *      to point at /manifest.json.
 *   4. Writes .env.role so runtime code (AppRoleEnforcer, RoleInstallPage) can
 *      pin the app to a single role via VITE_APP_ROLE=<role>.
 *   5. Prints the follow-up checklist (Supabase env vars, CNAME, remove other
 *      role routes if desired).
 *
 * It does NOT:
 *   - Delete other roles' pages/routes (leave that for a manual pass so nothing
 *     breaks at build time; unused routes tree-shake fine).
 *   - Touch supabase/ or src/integrations/supabase/ (backend stays shared).
 *   - Commit anything. Review `git diff` before pushing.
 *
 * Usage (inside a remix):
 *   node scripts/strip-to-role.mjs agent
 *   node scripts/strip-to-role.mjs merchant
 *   node scripts/strip-to-role.mjs distributor
 *   node scripts/strip-to-role.mjs super-distributor
 *   node scripts/strip-to-role.mjs admin
 * -----------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const ROLES = ["agent", "merchant", "distributor", "super-distributor", "admin"];
const role = process.argv[2];

if (!role || !ROLES.includes(role)) {
  console.error(`Usage: node scripts/strip-to-role.mjs <${ROLES.join("|")}>`);
  process.exit(1);
}

const ROLE_LABEL = {
  agent: "EasyPay Agent",
  merchant: "EasyPay Merchant",
  distributor: "EasyPay Distributor",
  "super-distributor": "EasyPay Super Distributor",
  admin: "EasyPay Admin",
};

const ROLE_DESC = {
  agent: "Cash-in, cash-out, bill pay, and customer onboarding.",
  merchant: "Accept payments, manage products, and track analytics.",
  distributor: "Create agents, manage float, and track commissions.",
  "super-distributor": "Manage distributors, float allocation, and commission networks.",
  admin: "Manage users, transactions, fraud alerts and settings.",
};

const ROLE_THEME = {
  agent: "#f59e0b",
  merchant: "#e11d48",
  distributor: "#2563eb",
  "super-distributor": "#7c3aed",
  admin: "#059669",
};

const root = process.cwd();
const pub = (p) => resolve(root, "public", p);

// 1. Rewrite manifest.json from manifest-<role>.json, forcing scope/start_url to "/".
const srcManifest = pub(`manifest-${role}.json`);
if (!existsSync(srcManifest)) {
  console.error(`Missing ${srcManifest}. Run this inside an EasyPay remix.`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(srcManifest, "utf8"));
manifest.id = "/";
manifest.scope = "/";
manifest.start_url = "/";
manifest.name = ROLE_LABEL[role];
manifest.short_name = ROLE_LABEL[role].replace("EasyPay ", "EP ");
manifest.theme_color = ROLE_THEME[role];
writeFileSync(pub("manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`✓ Wrote public/manifest.json for ${role}`);

// 2. Remove other role manifests.
for (const r of ROLES) {
  const p = pub(`manifest-${r}.json`);
  if (existsSync(p)) {
    rmSync(p);
    console.log(`  removed public/manifest-${r}.json`);
  }
}

// 3. Patch index.html.
const indexPath = resolve(root, "index.html");
if (existsSync(indexPath)) {
  let html = readFileSync(indexPath, "utf8");
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${ROLE_LABEL[role]}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${ROLE_DESC[role]}" />`,
  );
  html = html.replace(
    /<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?>/,
    `<meta name="theme-color" content="${ROLE_THEME[role]}" />`,
  );
  html = html.replace(
    /<link\s+rel="manifest"\s+href="[^"]*"\s*\/?>/,
    `<link rel="manifest" href="/manifest.json" />`,
  );
  writeFileSync(indexPath, html);
  console.log("✓ Patched index.html");
}

// 4. Pin runtime app role.
writeFileSync(resolve(root, ".env.role"), `VITE_APP_ROLE=${role}\n`);
console.log("✓ Wrote .env.role (VITE_APP_ROLE=" + role + ")");

console.log(`
Done. Next steps in this remix:
  1. Merge .env.role into .env (or your hosting env). VITE_APP_ROLE pins the shell
     so AppRoleEnforcer and RoleInstallPage lock to "${role}" only.
  2. Confirm VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY match the main
     project (shared backend).
  3. Project Settings → Domains → connect ${role === "super-distributor" ? "sd" : role === "distributor" ? "dist" : role}.smartshop.bd.
  4. Publish. Install from https://${role === "super-distributor" ? "sd" : role === "distributor" ? "dist" : role}.smartshop.bd/ — the browser will
     treat it as an independent origin, so it installs alongside every other
     role app on the same device.
`);
