import { forwardRef, AnchorHTMLAttributes, MouseEvent } from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";

/**
 * Safe external link component.
 *
 * - Forces rel="noopener noreferrer" (prevents reverse tabnabbing).
 * - Validates href against an allow-list of safe URL schemes (http, https, mailto, tel).
 * - Defaults to opening in a new tab.
 * - Optionally renders a small external-link icon.
 * - Accessible: announces "(opens in new tab)" to screen readers when target is _blank.
 */

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function isSafeUrl(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Block javascript:, data:, vbscript:, etc.
  try {
    const url = new URL(trimmed, window.location.origin);
    return SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export interface ExternalLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target" | "rel"> {
  href: string;
  /** Defaults to "_blank". Pass "_self" to navigate in the same tab. */
  target?: "_blank" | "_self";
  /** Show a trailing external-link icon. Defaults to false. */
  showIcon?: boolean;
  /** Custom rel additions. "noopener noreferrer" is always included for _blank. */
  rel?: string;
}

export const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  ({ href, target = "_blank", showIcon = false, rel, children, onClick, ...rest }, ref) => {
    const safe = isSafeUrl(href);

    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
      if (!safe) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    const finalRel =
      target === "_blank"
        ? ["noopener", "noreferrer", rel].filter(Boolean).join(" ")
        : rel;

    return (
      <a
        ref={ref}
        href={safe ? href : undefined}
        target={target}
        rel={finalRel}
        onClick={handleClick}
        aria-disabled={!safe || undefined}
        {...rest}
      >
        {children}
        {showIcon && (
          <ExternalLinkIcon
            className="inline-block ml-1 h-3.5 w-3.5"
            aria-hidden="true"
          />
        )}
        {target === "_blank" && (
          <span className="sr-only"> (opens in new tab)</span>
        )}
      </a>
    );
  }
);

ExternalLink.displayName = "ExternalLink";

export default ExternalLink;
