import { AlertCircle } from "lucide-react";
import type { LocationMismatch } from "@/lib/detectLocationMismatch";

interface Props {
  mismatch: LocationMismatch | null;
  className?: string;
}

const FIELD_LABEL: Record<LocationMismatch["field"], string> = {
  division: "Division",
  district: "District",
  upazila: "Upazila / Thana",
  union_parishad: "Union / Powrashava / City Corp.",
};

/**
 * Consistent inline error banner shown under the location picker across
 * merchant apply, admin agent, and distributor creation flows. Names the
 * specific field that failed the hierarchy validator so users know exactly
 * what to correct.
 */
export default function LocationMismatchAlert({ mismatch, className }: Props) {
  if (!mismatch) return null;
  return (
    <div
      role="alert"
      data-testid="location-mismatch-alert"
      data-field={mismatch.field}
      className={
        "rounded-md border border-destructive/40 bg-destructive/5 p-2.5 flex gap-2 " +
        (className ?? "")
      }
    >
      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-destructive">
          {FIELD_LABEL[mismatch.field]} needs correction
        </p>
        <p className="text-[11px] text-destructive/90 mt-0.5 break-words">
          {mismatch.message}
        </p>
      </div>
    </div>
  );
}
