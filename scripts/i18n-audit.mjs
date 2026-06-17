#!/usr/bin/env node
/**
 * i18n coverage audit.
 *
 * Heuristic scanner for hardcoded English UI strings in src/pages and
 * src/components. Flags JSX text nodes, common attribute strings
 * (placeholder/title/aria-label/alt) and toast({ title/description }) calls
 * that contain 3+ ASCII letters but no Bangla characters and are not
 * already routed through `t(...)`.
 *
 * Usage:
 *   node scripts/i18n-audit.mjs               # human report
 *   node scripts/i18n-audit.mjs --json        # JSON report
 *   node scripts/i18n-audit.mjs --max=50      # limit findings shown
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/pages", "src/components"];
const SKIP_DIRS = new Set(["__tests__", "test", "tests"]);
const ENGLISH_RE = /[A-Za-z]{3,}/;
const BANGLA_RE = /[\u0980-\u09FF]/;

// Words/strings to ignore (technical, not user-facing)
const IGNORE_VALUES = new Set([
  "true", "false", "null", "undefined", "px", "rem", "em", "auto", "none",
  "flex", "grid", "block", "inline", "hidden", "visible", "absolute",
  "relative", "fixed", "sticky", "static", "row", "col", "center",
  "left", "right", "top", "bottom", "start", "end", "between", "around",
  "div", "span", "button", "input", "form", "submit", "reset",
]);

function walk(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return files; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(tsx|jsx)$/.test(name) && !/\.test\.|\.spec\./.test(name)) files.push(p);
  }
  return files;
}

function isLikelyUserFacing(value) {
  const v = value.trim();
  if (v.length < 3) return false;
  if (!ENGLISH_RE.test(v)) return false;
  if (BANGLA_RE.test(v)) return false;
  if (IGNORE_VALUES.has(v.toLowerCase())) return false;
  // CSS-y class strings
  if (/^[a-z0-9:_\-\/\[\]\s]+$/.test(v) && /\s/.test(v) && !/[A-Z]/.test(v)) return false;
  // URLs / paths / imports
  if (/^https?:\/\//.test(v)) return false;
  if (/^\/[a-z0-9_\-\/]+$/i.test(v)) return false;
  if (/^[a-z0-9_\-]+\.(svg|png|jpe?g|webp|gif|css|ts|tsx|js)$/i.test(v)) return false;
  // single camelCase / SCREAMING tokens
  if (!/\s/.test(v) && /^[a-z][a-zA-Z0-9]*$/.test(v)) return false;
  if (/^[A-Z_]+$/.test(v) && !/\s/.test(v)) return false;
  return true;
}

const findings = [];

const PATTERNS = [
  // JSX text node: >Hello world<
  { name: "jsx-text", re: />\s*([^<>{}\n]{3,}?)\s*</g, group: 1 },
  // Common a11y/UX string attributes
  { name: "attr", re: /\b(?:placeholder|title|aria-label|alt|label)\s*=\s*"([^"]{3,})"/g, group: 1 },
  // toast({ title: "...", description: "..." })
  { name: "toast", re: /\b(?:title|description|message)\s*:\s*"([^"]{3,})"/g, group: 1 },
];

function scanFile(file) {
  const src = readFileSync(file, "utf8");
  // Strip block comments to reduce noise
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const { name, re, group } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      const value = m[group];
      if (!isLikelyUserFacing(value)) continue;
      // Skip if context shows a t(...) call wrapping it nearby (same match span)
      const before = code.slice(Math.max(0, m.index - 6), m.index);
      if (/\bt\(\s*$/.test(before)) continue;
      const line = code.slice(0, m.index).split("\n").length;
      findings.push({
        file: relative(ROOT, file),
        line,
        kind: name,
        value: value.length > 100 ? value.slice(0, 97) + "..." : value,
      });
    }
  }
}

for (const dir of SCAN_DIRS) {
  for (const f of walk(join(ROOT, dir))) scanFile(f);
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const maxArg = args.find((a) => a.startsWith("--max="));
const max = maxArg ? parseInt(maxArg.split("=")[1], 10) : Infinity;

if (asJson) {
  console.log(JSON.stringify({ count: findings.length, findings: findings.slice(0, max) }, null, 2));
} else {
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  let shown = 0;
  console.log(`\ni18n audit — ${findings.length} candidate hardcoded strings in ${byFile.size} files\n`);
  for (const [file, list] of sorted) {
    if (shown >= max) break;
    console.log(`▸ ${file}  (${list.length})`);
    for (const f of list.slice(0, 10)) {
      console.log(`    L${f.line} [${f.kind}]  ${f.value}`);
      shown++;
      if (shown >= max) break;
    }
    if (list.length > 10) console.log(`    … +${list.length - 10} more`);
  }
  console.log(`\nTop files account for the bulk of work. Use --json for the full machine-readable list.\n`);
}

// Exit non-zero for CI gating if anything is found (opt-in via env)
if (process.env.I18N_AUDIT_FAIL_ON_FINDINGS && findings.length > 0) {
  process.exit(1);
}
