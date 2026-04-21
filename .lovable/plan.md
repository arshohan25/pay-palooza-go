

## LEA Report: Report ID Display, Input Validation, and Report History

### Changes

**1. New database table: `lea_reports`**

Create a migration for a new table to persist all generated LEA reports:

```sql
CREATE TABLE public.lea_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL,
  phone text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  authority text NOT NULL,
  reference_no text NOT NULL,
  issue_date date NOT NULL,
  sections_included text[] NOT NULL DEFAULT '{}',
  generated_by uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb DEFAULT '{}'
);

ALTER TABLE public.lea_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage LEA reports"
  ON public.lea_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

The `summary` JSONB column stores key stats (total txns, total in/out, fraud count, etc.) for the history list view without needing to re-query.

**2. File: `src/components/admin/AdminLEARequest.tsx`**

**Report ID on-screen display:**
- Generate the Report ID once when a user is found (store in state via `useState<string>("")`), not on every render call
- Show the Report ID in the on-screen preview card header (e.g. between the search card and the data preview card) as a prominent Badge
- The printable header already shows it; ensure it uses the same stored value instead of calling `generateReportId()` again each render

**Input validation with visual warnings:**
- Add `fieldErrors` state: `{ authority: boolean; refNo: boolean; issueDate: boolean }`
- Show red border + "Required" text under Authority, Ref No, and Issue Date inputs when empty on download attempt
- Validate Issue Date is a valid date (not empty string)
- Clear field errors on input change
- Disable the Download PDF button entirely when any required field is empty (gray out with tooltip)

**Save report to database on download:**
- After successful PDF generation, insert a row into `lea_reports` with: report_id, phone, target_user_id, authority, reference_no, issue_date, sections_included (array of enabled section keys), generated_by (current admin user ID), and summary JSON (total txns, total in/out, fraud alerts count, disputes count)

**Report History section:**
- Add a new Card below the main content titled "LEA Reports History"
- Fetch from `lea_reports` ordered by `generated_at DESC`, limit 50
- Display as a compact table with columns: Report ID, Phone, Authority, Ref No, Issue Date, Generated At, Sections Count
- Auto-refresh the history list after each new download
- Load history on component mount

### Files touched
- New migration for `lea_reports` table
- `src/components/admin/AdminLEARequest.tsx` (edit)

