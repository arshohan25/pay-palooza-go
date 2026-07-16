## Current state

- `bnUnion()` only translates structural patterns: `<X> Powrashava`, `<X> Sadar`, `<X> City Corporation`. That covers ~600 powrashavas and 13 city corporations.
- Plain union names (4,060 unique rows in `unions` where `type='union'`, e.g. "Gazipur", "Barahatia", "Char Kadira") fall through to English in Bangla mode.
- No e2e test currently asserts Bangla union labels.

Exhaustively hand-translating 4,060 romanised Bengali union names in TypeScript is impractical and bloats the bundle. The right home for these strings is the database.

## Plan

### 1. Add a Bangla name column on `unions` (migration)
- `ALTER TABLE public.unions ADD COLUMN name_bn text;`
- No RLS change needed (existing read policy already exposes the row).

### 2. Extend fetch + translation
- `DivisionDistrictUpazilaPicker.tsx` → `loadUnions()` selects `name_bn` too.
- Enrich `UnionRow` and pass `name_bn` through to `UnionSearchSelect`.
- `bnLocation.ts` → `bnUnion(name, nameBn?)` prefers `nameBn` when present, else falls back to today's pattern rules, else English.
- `UnionSearchSelect` search matcher also matches on `name_bn` so Bangla queries find rows.

### 3. Seed Bangla names (best-effort, incremental)
- Add `scripts/seed-union-bn.mjs` that upserts `name_bn` for the structural cases we can derive deterministically (Powrashava / Sadar / City Corp using the existing upazila/district Bangla maps). This immediately fills ~640 rows and leaves plain unions null (which then fall back to English — same behaviour as today, no regression).
- Long-tail plain union names remain a follow-up: they can be back-filled later via a data source or manual review without any further code change.

### 4. e2e test — `e2e/i18n-bn-union-list.spec.ts`
- Switch app language to Bangla, open Division→District→Upazila picker with a district known to have a Powrashava (e.g. Narail / Kalia), open the Union popover.
- Assert:
  - `data-testid="union-empty"` and `union-loading` labels render in Bangla when applicable.
  - At least one visible row contains Bangla script (`/[\u0980-\u09FF]/`) — proves translation pipeline works end-to-end.
  - Group headers ("সিটি কর্পোরেশন", "পৌরসভা", "ইউনিয়ন") render in Bangla.
- Also add a small unit assertion in `src/lib/bnLocation.ts` covering `bnUnion` with and without `name_bn`.

### Technical notes
- Migration keeps `name_bn` nullable so existing rows and seed scripts stay valid.
- `UnionSearchSelect.displayName` prop signature stays the same; the picker just passes a closure that looks up `name_bn` for the given English name.
- No change to selection value — we continue to persist the English `name` in `union_parishad` so downstream validation (`detectLocationMismatch`, edge functions) is unaffected.

Shall I proceed with this plan? If you already have a Bangla-name data source (CSV/JSON) for the 4,060 plain unions, share it and I'll wire the seeder to consume it in the same pass.