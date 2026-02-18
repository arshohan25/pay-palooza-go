/**
 * Tracks new (unviewed) transaction count.
 * Flows call `addTxnNotif()` on success; history tab calls `clearTxnNotifs()`.
 */

let count = 0;
const listeners = new Set<(n: number) => void>();

export const getTxnNotifCount = () => count;

export const addTxnNotif = () => {
  count += 1;
  listeners.forEach((fn) => fn(count));
};

export const clearTxnNotifs = () => {
  if (count === 0) return;
  count = 0;
  listeners.forEach((fn) => fn(count));
};

export const onTxnNotifChange = (fn: (n: number) => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
