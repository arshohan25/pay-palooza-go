/**
 * Tracks unread inbox message count.
 * InboxPage calls `addInboxMsg()` on incoming message; clearing happens when chat is opened.
 */

let count = 0;
const listeners = new Set<(n: number) => void>();

export const getInboxCount = () => count;

export const addInboxMsg = (n = 1) => {
  count += n;
  listeners.forEach((fn) => fn(count));
};

export const clearInboxCount = () => {
  if (count === 0) return;
  count = 0;
  listeners.forEach((fn) => fn(count));
};

export const onInboxChange = (fn: (n: number) => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
