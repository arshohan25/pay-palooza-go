/**
 * Shared weak PIN validation.
 * Rejects sequential digits (ascending/descending) and repeated digits.
 */

const SEQUENTIAL = [
  "0123","1234","2345","3456","4567","5678","6789",
  "9876","8765","7654","6543","5432","4321","3210",
];

const REPEATED = [
  "0000","1111","2222","3333","4444","5555","6666","7777","8888","9999",
];

/** Returns true if the PIN is too weak (sequential or repeated digits) */
export function isWeakPin(pin: string): boolean {
  return SEQUENTIAL.includes(pin) || REPEATED.includes(pin);
}
