/**
 * Dev-only harness that renders the shared bank list used by the customer,
 * agent, and merchant bank-link flows. Every flow reads from the same
 * `usePlatformBanks` hook, so this harness validates the ordering, logo
 * rendering, and default-flagging contract that all three UIs inherit.
 *
 * It also exposes an interactive picker + submit surface per flow, used by
 * the `bank-picker-submit-cross-flow` Playwright spec to prove that a bank
 * can be selected and the flow submitted in customer, agent, and merchant.
 *
 * Rendered at `/__test/bank-picker-harness` (dev builds only).
 */

import { useState } from "react";
import { usePlatformBanks } from "@/hooks/use-platform-banks";
import { BankLogo } from "@/components/BankLogo";
import { BankListLiveBadge } from "@/components/BankListLiveBadge";
import { bankColorFromName } from "@/lib/bangladeshBanks";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FLOWS: Array<{ id: "customer" | "agent" | "merchant"; label: string; submitLabel: string }> = [
  { id: "customer", label: "Customer bank transfer", submitLabel: "Transfer" },
  { id: "agent", label: "Agent bank transfer", submitLabel: "Send" },
  { id: "merchant", label: "Merchant bank link", submitLabel: "Link Bank" },
];

function FlowPicker({
  flowId,
  submitLabel,
  banks,
}: {
  flowId: "customer" | "agent" | "merchant";
  submitLabel: string;
  banks: ReturnType<typeof usePlatformBanks>["banks"];
}) {
  const defaultBank = banks.find(b => b.is_default);
  const [selected, setSelected] = useState<string | undefined>(defaultBank?.id);
  const [submitted, setSubmitted] = useState<{ bankId: string; bankName: string } | null>(null);

  const handleSubmit = () => {
    const b = banks.find(x => x.id === selected);
    if (!b) return;
    setSubmitted({ bankId: b.id, bankName: b.name });
  };

  return (
    <div
      className="mt-3 space-y-2 border-t border-border/40 pt-3"
      data-testid={`picker-${flowId}`}
    >
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger data-testid={`picker-trigger-${flowId}`}>
          <SelectValue placeholder="Choose a bank..." />
        </SelectTrigger>
        <SelectContent>
          {banks.map(b => (
            <SelectItem
              key={b.id}
              value={b.id}
              data-testid={`picker-option-${flowId}-${b.id}`}
            >
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={!selected}
        onClick={handleSubmit}
        data-testid={`picker-submit-${flowId}`}
      >
        {submitLabel}
      </Button>
      {submitted && (
        <div
          data-testid={`picker-result-${flowId}`}
          data-submitted-bank-id={submitted.bankId}
          data-submitted-bank-name={submitted.bankName}
          className="text-xs text-emerald-600 font-medium"
        >
          Submitted: {submitted.bankName}
        </div>
      )}
    </div>
  );
}

export default function BankPickerHarness() {
  const { banks, loading, liveUpdateKey } = usePlatformBanks(false);

  return (
    <div className="min-h-screen bg-background p-6" data-testid="bank-picker-harness">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-bold">Bank picker harness</h1>
        <BankListLiveBadge liveUpdateKey={liveUpdateKey} label="Harness" toastOnUpdate={false} />
      </div>
      {loading && <p data-testid="banks-loading">Loading…</p>}
      <div className="grid gap-6 md:grid-cols-3">
        {FLOWS.map(flow => (
          <section
            key={flow.id}
            data-testid={`flow-${flow.id}`}
            data-flow={flow.id}
            className="border border-border rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">{flow.label}</h2>
              <BankListLiveBadge liveUpdateKey={liveUpdateKey} label={flow.label} toastOnUpdate={false} />
            </div>
            <ol className="space-y-2" data-testid={`bank-list-${flow.id}`}>
              {banks.map((b, idx) => (
                <li
                  key={b.id}
                  data-testid={`bank-row-${flow.id}-${b.id}`}
                  data-bank-id={b.id}
                  data-bank-name={b.name}
                  data-bank-order={idx}
                  data-bank-default={b.is_default ? "true" : "false"}
                  data-bank-has-logo={b.logo_url ? "true" : "false"}
                  className="flex items-center gap-3 p-2 rounded border border-border/40"
                >
                  <BankLogo
                    bank={{
                      name: b.name,
                      short: b.short_code,
                      color: bankColorFromName(b.name),
                      logo_url: b.logo_url,
                    }}
                    size={28}
                  />
                  <span className="text-xs font-medium">{b.name}</span>
                  {b.is_default && (
                    <span
                      data-testid={`default-marker-${flow.id}`}
                      className="ml-auto text-[10px] font-bold text-amber-600"
                    >
                      DEFAULT
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <FlowPicker flowId={flow.id} submitLabel={flow.submitLabel} banks={banks} />
          </section>
        ))}
      </div>
    </div>
  );
}
