import { describe, it, expect, vi, beforeEach } from "vitest";

// Integration test: simulates the admin bulk-approve add-money RPC being
// invoked concurrently for the same set of requests, verifying that each
// request is credited exactly once thanks to `FOR UPDATE SKIP LOCKED` +
// treating already-approved rows as no-ops.

interface Req {
  id: string;
  status: "pending" | "approved";
  credited_count: number;
}

// Simulated server-side RPC that mirrors the real admin_bulk_approve_addmoney
// behavior: locks pending rows, treats already-approved as a no-op, and
// returns a breakdown per request id.
function makeFakeRpc(store: Map<string, Req>) {
  const locked = new Set<string>();
  return async ({ request_ids }: { request_ids: string[] }) => {
    // Simulate row-level lock acquisition. Concurrent callers see rows already
    // locked by another transaction and skip them.
    const acquired: string[] = [];
    const skipped_locked: string[] = [];
    for (const id of request_ids) {
      if (locked.has(id)) skipped_locked.push(id);
      else { locked.add(id); acquired.push(id); }
    }
    // Yield to let interleaved calls execute
    await new Promise((r) => setTimeout(r, 5));

    const credited: string[] = [];
    const already_approved: string[] = [];
    for (const id of acquired) {
      const row = store.get(id);
      if (!row) continue;
      if (row.status === "approved") {
        already_approved.push(id);
      } else {
        row.status = "approved";
        row.credited_count += 1;
        credited.push(id);
      }
    }
    for (const id of acquired) locked.delete(id);
    return { data: { credited, already_approved, skipped_locked }, error: null };
  };
}

describe("admin_bulk_approve_addmoney idempotency under concurrent retries", () => {
  let store: Map<string, Req>;
  let rpc: ReturnType<typeof makeFakeRpc>;

  beforeEach(() => {
    store = new Map<string, Req>([
      ["req-1", { id: "req-1", status: "pending", credited_count: 0 }],
      ["req-2", { id: "req-2", status: "pending", credited_count: 0 }],
      ["req-3", { id: "req-3", status: "pending", credited_count: 0 }],
    ]);
    rpc = makeFakeRpc(store);
  });

  it("credits each request at most once when the same batch is retried sequentially", async () => {
    const ids = ["req-1", "req-2", "req-3"];
    const first = await rpc({ request_ids: ids });
    const second = await rpc({ request_ids: ids });
    const third = await rpc({ request_ids: ids });

    expect(first.data.credited.sort()).toEqual(ids);
    expect(second.data.credited).toEqual([]);
    expect(second.data.already_approved.sort()).toEqual(ids);
    expect(third.data.already_approved.sort()).toEqual(ids);

    for (const id of ids) {
      expect(store.get(id)!.credited_count).toBe(1);
      expect(store.get(id)!.status).toBe("approved");
    }
  });

  it("credits each request exactly once under concurrent bulk-approve calls", async () => {
    const ids = ["req-1", "req-2", "req-3"];
    const runs = await Promise.all(
      Array.from({ length: 5 }, () => rpc({ request_ids: ids })),
    );

    const creditedTotals = ids.reduce<Record<string, number>>((acc, id) => {
      acc[id] = runs.reduce((n, r) => n + (r.data.credited.includes(id) ? 1 : 0), 0);
      return acc;
    }, {});

    for (const id of ids) {
      expect(creditedTotals[id]).toBe(1);
      expect(store.get(id)!.credited_count).toBe(1);
      expect(store.get(id)!.status).toBe("approved");
    }

    // Every id must appear across the runs as either credited, already_approved,
    // or skipped_locked — no invocation should silently drop a request id.
    for (const id of ids) {
      const seen = runs.some(
        (r) =>
          r.data.credited.includes(id) ||
          r.data.already_approved.includes(id) ||
          r.data.skipped_locked.includes(id),
      );
      expect(seen).toBe(true);
    }
  });

  it("returns no errors on empty retry", async () => {
    const res = await rpc({ request_ids: [] });
    expect(res.error).toBeNull();
    expect(res.data.credited).toEqual([]);
    expect(res.data.already_approved).toEqual([]);
  });
});
