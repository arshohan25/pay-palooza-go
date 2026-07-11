/**
 * Pick the localized product name/description based on current UI language.
 * Falls back to the base (English/vendor-entered) field when the Bangla
 * value is missing or empty.
 */
export function pickLocalizedName(
  product: { name?: string | null; name_bn?: string | null } | null | undefined,
  lang: "en" | "bn" | string,
): string {
  if (!product) return "";
  if (lang === "bn" && product.name_bn && product.name_bn.trim()) return product.name_bn;
  return product.name ?? "";
}

export function pickLocalizedDescription(
  product: { description?: string | null; description_bn?: string | null } | null | undefined,
  lang: "en" | "bn" | string,
): string {
  if (!product) return "";
  if (lang === "bn" && product.description_bn && product.description_bn.trim()) return product.description_bn;
  return product.description ?? "";
}
