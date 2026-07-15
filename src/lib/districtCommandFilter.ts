/**
 * Typeahead scorer for cmdk-based district pickers.
 *
 * `value` is the concatenated haystack we set on each CommandItem, e.g.
 * "Dhaka DH Dhaka". `search` is the user's query. We return a score in
 * [0, 1]; cmdk filters out any item that scores 0.
 *
 * Ranking (highest first):
 *   1.0  exact token match (district / code / division equals search)
 *   0.9  a token starts with search
 *   0.6  any token contains search (fuzzy)
 *   0.4  characters appear in order (subsequence match)
 *   0.0  no match
 */
export function districtCommandFilter(value: string, search: string): number {
  if (!search) return 1;
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const hay = value.toLowerCase();
  const tokens = hay.split(/\s+/).filter(Boolean);

  if (tokens.includes(q)) return 1;
  if (tokens.some((t) => t.startsWith(q))) return 0.9;
  if (hay.includes(q)) return 0.6;

  // subsequence fallback so "dhk" matches "dhaka"
  let i = 0;
  for (const ch of hay) {
    if (ch === q[i]) i++;
    if (i === q.length) return 0.4;
  }
  return 0;
}
