/**
 * Dev-only harness that renders the shared bank list used by the customer,
 * agent, and merchant bank-link flows. Every flow reads from the same
 * `usePlatformBanks` hook, so this harness validates the ordering, logo
 * rendering, and default-flagging contract that all three UIs inherit.
 *
 * Rendered at `/__test/bank-picker-harness` (dev builds only).
 */

import { usePlatformBanks } from "@/hooks/use-platform-banks";
import { BankLogo } from "@/components/BankLogo";
import { BankListLiveBadge } from "@/components/BankListLiveBadge";
import { bankColorFromName } from "@/lib/bangladeshBanks";

const FLOWS: Array<{ id: string; label: string }> = [
  { id: "customer", label: "Customer bank transfer" },
  { id: "agent", label: "Agent bank transfer" },
  { id: "merchant", label: "Merchant bank link" },
];

export default function BankPickerHarness() {
  const { banks, loading, liveUpdateKey } = usePlatformBanks(false);

  return (
    <div className="min-h-screen bg-background p-6" data-testid="bank-picker-harness">
      <h1 className="text-lg font-bold mb-4">Bank picker harness</h1>
      {loading && <p data-testid="banks-loading">Loading…</p>}
      <div className="grid gap-6 md:grid-cols-3">
        {FLOWS.map(flow => (
          <section
            key={flow.id}
            data-testid={`flow-${flow.id}`}
            data-flow={flow.id}
            className="border border-border rounded-lg p-3"
          >
            <h2 className="text-sm font-semibold mb-2">{flow.label}</h2>
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
          </section>
        ))}
      </div>
    </div>
  );
}
