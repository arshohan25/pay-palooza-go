import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  pickFirstWithSiblingConfidence,
  resolveConfidence,
  type ConfidenceLevel,
} from "@/lib/ocrConfidence";
import { flushKycAnalytics, trackKycEvent } from "@/lib/kycAnalytics";

/**
 * Dev-only harness that reproduces the exact "NID details" step behavior we
 * care about in end-to-end tests, without depending on the real KYC-OCR edge
 * function, camera capture, or Supabase auth:
 *
 *   - Initial populated state (from the first "OCR" run).
 *   - Rescan → window.confirm → skeleton visible → OCR-derived fields cleared
 *     → fields repopulated after the mocked async OCR resolves.
 *   - Per-field confidence badges for BN name, father, and mother — computed
 *     from the same helpers KycFlow uses in production.
 *
 * The mocked OCR payload includes explicit `{value, confidence}` shapes so
 * we exercise the sibling/nested confidence extraction path too.
 */

type OcrPayload = {
  full_name_bn: { value: string; confidence: number };
  father_name: string;
  father_name_confidence: number;
  mother_name: string;
  mother_name_confidence: number;
  nid_number: string;
  date_of_birth: string;
};

const INITIAL_PAYLOAD: OcrPayload = {
  full_name_bn: { value: "তানভীর হাসান", confidence: 0.94 },
  father_name: "Abdul Karim",
  father_name_confidence: 0.9,
  mother_name: "Ayesha",
  mother_name_confidence: 0.7,
  nid_number: "19901234567890",
  date_of_birth: "01/01/1990",
};

// The rescan run returns a slightly different payload so tests can assert
// that repopulation reflects the *new* OCR result, not the stale one.
const RESCAN_PAYLOAD: OcrPayload = {
  full_name_bn: { value: "মোঃ তানভীর হাসান", confidence: 0.97 },
  father_name: "Abdul Karim Chowdhury",
  father_name_confidence: 0.95,
  mother_name: "Ayesha Begum",
  mother_name_confidence: 0.92,
  nid_number: "19901234567890",
  date_of_birth: "01/01/1990",
};

const CONF_CLASS: Record<ConfidenceLevel, string> = {
  high: "conf-high",
  medium: "conf-medium",
  low: "conf-low",
  none: "conf-none",
};

const KycOcrRescanHarness = () => {
  const [raw, setRaw] = useState<OcrPayload | null>(INITIAL_PAYLOAD);
  const [nameBn, setNameBn] = useState(INITIAL_PAYLOAD.full_name_bn.value);
  const [father, setFather] = useState(INITIAL_PAYLOAD.father_name);
  const [mother, setMother] = useState(INITIAL_PAYLOAD.mother_name);
  const [loading, setLoading] = useState(false);
  const [runCount, setRunCount] = useState(1);

  // Test-only escape hatch: expose the tracker so e2e specs can drive
  // arbitrary (including intentionally-invalid) payloads to exercise the
  // runtime schema validator without needing a fake UI surface.
  useEffect(() => {
    (window as unknown as { __kycTrack?: typeof trackKycEvent }).__kycTrack = trackKycEvent;
    return () => {
      delete (window as unknown as { __kycTrack?: typeof trackKycEvent }).__kycTrack;
    };
  }, []);

  const resolveEdited = (
    kind: Parameters<typeof resolveConfidence>[0],
    keys: string[],
    current: string,
  ) => {
    const picked = pickFirstWithSiblingConfidence(raw as unknown as Record<string, unknown>, keys);
    const edited = picked.value.trim() !== current.trim();
    return resolveConfidence(kind, {
      value: current,
      confidence: edited ? null : picked.confidence,
    });
  };

  const bnConf = useMemo(() => resolveEdited("name_bn", ["full_name_bn"], nameBn), [raw, nameBn]);
  const fatherConf = useMemo(() => resolveEdited("father", ["father_name"], father), [raw, father]);
  const motherConf = useMemo(() => resolveEdited("mother", ["mother_name"], mother), [raw, mother]);

  // Emit a `kyc_ocr_confidence` event whenever a per-field level is (re)computed.
  // The tracker itself dedups, throttles, and samples — we just fire on every
  // change so the tracker's suppression logic is exercised.
  useEffect(() => {
    trackKycEvent("kyc_ocr_confidence", { side: "front", field: "bn_name", level: bnConf });
  }, [bnConf]);
  useEffect(() => {
    trackKycEvent("kyc_ocr_confidence", { side: "front", field: "father", level: fatherConf });
  }, [fatherConf]);
  useEffect(() => {
    trackKycEvent("kyc_ocr_confidence", { side: "front", field: "mother", level: motherConf });
  }, [motherConf]);

  const runStartAt = useRef<number>(0);

  const runOcr = useCallback(async (payload: OcrPayload) => {
    runStartAt.current = Date.now();
    trackKycEvent("kyc_ocr_run_start", { side: "front" });
    setLoading(true);
    // Clear all OCR-derived fields immediately so the skeleton state is
    // observable — this is exactly what KycFlow does with `opts.reset`.
    setNameBn("");
    setFather("");
    setMother("");
    setRaw(null);
    await new Promise((r) => setTimeout(r, 400));
    setRaw(payload);
    setNameBn(payload.full_name_bn.value);
    setFather(payload.father_name);
    setMother(payload.mother_name);
    setRunCount((n) => n + 1);
    setLoading(false);
    // Summary event closes out the run with a confidences snapshot.
    trackKycEvent("kyc_ocr_run_end", {
      side: "front",
      status: "success",
      duration_ms: Date.now() - runStartAt.current,
      confidences: {
        bn_name: resolveConfidence("name_bn", { value: payload.full_name_bn.value, confidence: payload.full_name_bn.confidence }),
        father: resolveConfidence("father", { value: payload.father_name, confidence: payload.father_name_confidence }),
        mother: resolveConfidence("mother", { value: payload.mother_name, confidence: payload.mother_name_confidence }),
      },
    });
  }, []);

  const handleRescan = useCallback(() => {
    const ok = window.confirm(
      "Rescan NID? This will clear the current extracted fields and re-run OCR.",
    );
    if (!ok) {
      trackKycEvent("kyc_ocr_rescan_cancelled", { side: "front" });
      return;
    }
    trackKycEvent("kyc_ocr_rescan_confirmed", { side: "front", reset: true });
    // Flush per-field throttle/sample state so the fresh run isn't blocked
    // by leftover cooldowns from the previous session.
    flushKycAnalytics();
    void runOcr(RESCAN_PAYLOAD);
  }, [runOcr]);

  return (
    <div style={{ maxWidth: 420, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>KYC OCR Rescan Harness</h1>
      <p data-testid="harness-run-count">runs:{runCount}</p>

      <button data-testid="rescan-btn" onClick={handleRescan} disabled={loading}>
        Rescan
      </button>

      {loading && (
        <div
          data-testid="ocr-skeleton"
          aria-busy="true"
          style={{ marginTop: 16, padding: 16, border: "1px dashed #999" }}
        >
          <div style={{ height: 12, background: "#eee", marginBottom: 8 }} />
          <div style={{ height: 12, background: "#eee", marginBottom: 8 }} />
          <div style={{ height: 12, background: "#eee" }} />
          Loading…
        </div>
      )}

      {!loading && (
        <div data-testid="ocr-fields" style={{ marginTop: 16 }}>
          <label>
            BN name
            <input
              data-testid="field-bn-name"
              value={nameBn}
              onChange={(e) => setNameBn(e.target.value)}
            />
            <span data-testid="conf-bn-name" className={CONF_CLASS[bnConf]}>
              {bnConf}
            </span>
          </label>

          <label>
            Father
            <input
              data-testid="field-father"
              value={father}
              onChange={(e) => setFather(e.target.value)}
            />
            <span data-testid="conf-father" className={CONF_CLASS[fatherConf]}>
              {fatherConf}
            </span>
          </label>

          <label>
            Mother
            <input
              data-testid="field-mother"
              value={mother}
              onChange={(e) => setMother(e.target.value)}
            />
            <span data-testid="conf-mother" className={CONF_CLASS[motherConf]}>
              {motherConf}
            </span>
          </label>
        </div>
      )}
    </div>
  );
};

export default KycOcrRescanHarness;
