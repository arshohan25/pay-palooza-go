/**
 * Translate raw Postgres/PostgREST error messages coming from the
 * distributors table (parent_id trigger, etc.) into user-facing text.
 * Returns null when no known pattern matches.
 */
export function mapDistributorDbError(msg: string | undefined | null): string | null {
  if (!msg) return null;
  const m = msg.toLowerCase();

  if (m.includes("parent_id must reference a super distributor")) {
    return "The selected parent is not a Super Distributor. Pick a Super Distributor from the list.";
  }
  if (m.includes("does not reference an existing distributor")) {
    return "The selected parent Super Distributor no longer exists. Refresh and try again.";
  }
  if (m.includes("cannot be its own parent")) {
    return "A distributor cannot be linked to itself as a parent.";
  }
  if (m.includes("invalid location hierarchy")) {
    return "Selected Division › District › Upazila do not match. Please re-pick the location.";
  }
  return null;
}
