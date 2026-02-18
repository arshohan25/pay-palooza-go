/**
 * Lightweight reactive balance store.
 * Components subscribe via `onBalanceChange`; flows call `deductBalance`.
 */

let balance = 12450.75;
const listeners = new Set<(b: number) => void>();

export const getBalance = () => balance;

export const deductBalance = (amount: number) => {
  balance = Math.max(0, balance - amount);
  listeners.forEach((fn) => fn(balance));
};

export const addBalance = (amount: number) => {
  balance = balance + amount;
  listeners.forEach((fn) => fn(balance));
};

export const onBalanceChange = (fn: (b: number) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
