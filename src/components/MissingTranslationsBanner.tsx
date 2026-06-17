import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getMissingTranslations,
  subscribeMissingTranslations,
  resetMissingTranslationKeys,
  useI18n,
  type MissingTranslationEntry,
} from "@/lib/i18n";

/**
 * Dev-only floating banner that lists missing translation keys with the
 * affected page/component (inferred from the call-site stack trace).
 *
 * Renders ONLY when:
 *   - import.meta.env.DEV is true
 *   - current UI language is "bn"
 *   - at least one missing key has been recorded
 *
 * Hidden in production builds entirely (early return on !DEV).
 */
function snapshot(): MissingTranslationEntry[] {
  return getMissingTranslations();
}

function subscribe(cb: () => void) {
  return subscribeMissingTranslations(cb);
}

export default function MissingTranslationsBanner() {
  // Bail out completely in production builds.
  if (!import.meta.env.DEV) return null;

  const { lang } = useI18n();
  const entries = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Reset hidden state when entries change
  useEffect(() => {
    if (entries.length === 0) setHidden(false);
  }, [entries.length]);

  if (lang !== "bn") return null;
  if (entries.length === 0) return null;
  if (hidden) return null;

  // De-dupe by key (entries are already per key::lang).
  const byKey = entries.filter((e) => e.lang === "bn");
  if (byKey.length === 0) return null;

  return (
    <div
      role="status"
      aria-label="Missing translation keys"
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        right: 12,
        zIndex: 2_147_483_000,
        maxWidth: 520,
        marginLeft: "auto",
        marginRight: "auto",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        fontSize: 12,
        color: "#fff8e1",
        background: "rgba(120, 53, 15, 0.96)",
        border: "1px solid #f59e0b",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
        }}
      >
        <span aria-hidden style={{ fontSize: 14 }}>⚠️</span>
        <strong style={{ flex: 1 }}>
          i18n: {byKey.length} missing Bangla key{byKey.length === 1 ? "" : "s"}
        </strong>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={btnStyle}
        >
          {expanded ? "Hide" : "Details"}
        </button>
        <button
          type="button"
          onClick={() => {
            resetMissingTranslationKeys();
          }}
          style={btnStyle}
          title="Clear the recorded list"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          style={{ ...btnStyle, padding: "2px 6px" }}
          aria-label="Dismiss banner"
        >
          ✕
        </button>
      </div>
      {expanded && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: "0 10px 10px",
            maxHeight: 220,
            overflowY: "auto",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          }}
        >
          {byKey.map((e) => (
            <li
              key={`${e.key}::${e.lang}`}
              style={{
                padding: "4px 0",
                borderTop: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div style={{ color: "#fde68a", fontWeight: 600 }}>
                ⟦{e.key}⟧
              </div>
              {e.sources.length > 0 ? (
                e.sources.map((s) => (
                  <div key={s} style={{ color: "#e5e7eb", paddingLeft: 8 }}>
                    ↳ {s}
                  </div>
                ))
              ) : (
                <div style={{ color: "#9ca3af", paddingLeft: 8 }}>
                  ↳ (source unknown)
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.25)",
  color: "#fff",
  borderRadius: 8,
  padding: "2px 8px",
  fontSize: 11,
  cursor: "pointer",
};
