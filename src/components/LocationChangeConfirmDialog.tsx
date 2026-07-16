import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowRight, MapPin, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface LocationSnapshot {
  division: string | null;
  district: string | null;
  upazila: string | null;
  union_parishad: string | null;
  area_type: string | null;
  territory_code: string | null;
}

export interface LocationDiffRow {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
}

interface Props {
  open: boolean;
  before: LocationSnapshot;
  after: LocationSnapshot;
  /** Label for the derived code row — defaults to "Route / Territory code". */
  codeLabel?: string;
  /** Optional custom title (defaults to the localized "Confirm location change"). */
  title?: string;
  /** When provided, these rows are rendered instead of the default 6-field snapshot. */
  overrideRows?: LocationDiffRow[];
  saving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const L = {
  en: {
    title: "Confirm location change",
    desc: "Review the before / after values below. The wallet code is auto-derived from the selected district.",
    field: "Field", before: "Before", after: "After",
    division: "Division", district: "District", upazila: "Upazila / Thana",
    union: "Union / Powrashava / City Corp.", type: "Area type",
    code: "Route / Territory code",
    empty: "—", cancel: "Cancel", confirm: "Confirm & save",
  },
  bn: {
    title: "লোকেশন পরিবর্তন নিশ্চিত করুন",
    desc: "নিচে পূর্বের ও নতুন মান দেখুন। ওয়ালেট কোড নির্বাচিত জেলা থেকে স্বয়ংক্রিয়ভাবে নির্ধারিত হয়।",
    field: "ফিল্ড", before: "পূর্বে", after: "পরিবর্তনের পর",
    division: "বিভাগ", district: "জেলা", upazila: "উপজেলা / থানা",
    union: "ইউনিয়ন / পৌরসভা / সিটি কর্প.", type: "এলাকার ধরন",
    code: "রুট / টেরিটরি কোড",
    empty: "—", cancel: "বাতিল", confirm: "নিশ্চিত করে সংরক্ষণ",
  },
} as const;

export default function LocationChangeConfirmDialog({
  open, before, after, codeLabel, title, overrideRows, saving, onCancel, onConfirm,
}: Props) {
  const { lang } = useI18n();
  const l = L[lang === "bn" ? "bn" : "en"];

  const rows: LocationDiffRow[] = overrideRows ?? [
    { key: "division", label: l.division, before: before.division, after: after.division },
    { key: "district", label: l.district, before: before.district, after: after.district },
    { key: "upazila", label: l.upazila, before: before.upazila, after: after.upazila },
    { key: "union_parishad", label: l.union, before: before.union_parishad, after: after.union_parishad },
    { key: "area_type", label: l.type, before: before.area_type, after: after.area_type },
    { key: "territory_code", label: codeLabel || l.code, before: before.territory_code, after: after.territory_code },
  ];

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> {title || l.title}
          </AlertDialogTitle>
          <AlertDialogDescription>{l.desc}</AlertDialogDescription>
        </AlertDialogHeader>

        <div
          role="table"
          aria-label={title || l.title}
          className="rounded-md border border-border overflow-hidden text-sm"
        >
          <div className="grid grid-cols-[1fr_1fr_auto_1fr] items-center px-3 py-2 bg-muted/60 text-xs font-medium text-muted-foreground">
            <div>{l.field}</div>
            <div>{l.before}</div>
            <div />
            <div>{l.after}</div>
          </div>
          {rows.map(({ key, label, before: b, after: a }) => {
            const bv = b ?? "";
            const av = a ?? "";
            const changed = bv !== av;
            return (
              <div
                key={key}
                data-testid={`loc-row-${key}`}
                data-changed={changed ? "true" : "false"}
                className={
                  "grid grid-cols-[1fr_1fr_auto_1fr] items-center px-3 py-2 border-t border-border " +
                  (changed ? "bg-amber-500/10" : "bg-background")
                }
              >
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={"truncate " + (changed ? "line-through opacity-70" : "")}>{bv || l.empty}</div>
                <ArrowRight className={"w-3 h-3 mx-1 " + (changed ? "text-amber-600" : "text-muted-foreground/40")} />
                <div className={"truncate font-medium " + (changed ? "text-amber-700 dark:text-amber-300" : "")}>{av || l.empty}</div>
              </div>
            );
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving} onClick={onCancel}>{l.cancel}</AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={(e) => { e.preventDefault(); onConfirm(); }}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />{l.confirm}</> : l.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
