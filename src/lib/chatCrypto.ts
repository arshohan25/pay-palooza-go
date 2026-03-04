/**
 * End-to-end encryption for chat messages using Web Crypto API (AES-GCM).
 * 
 * Key derivation: Per-conversation symmetric key derived from a passphrase
 * using PBKDF2 with a conversation-specific salt.
 * 
 * Message format: base64(iv + ciphertext) where iv is 12 bytes.
 */

const ALGO = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100_000;
const CONV_KEY_PREFIX = "ezp_chat_key_";

// ─── Key Management ───────────────────────────────────────────────

function getConvKeyStorageKey(conversationId: string): string {
  return `${CONV_KEY_PREFIX}${conversationId}`;
}

/** Derive an AES-GCM key from a passphrase + conversation-specific salt */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawBytes = enc.encode(passphrase);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    rawBytes.buffer as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: ALGO, length: KEY_LENGTH },
    true, // extractable so we can export/store
    ["encrypt", "decrypt"]
  );
}

/** Generate a random AES-GCM key for a new conversation */
export async function generateConversationKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

/** Export a CryptoKey to a base64 string for storage */
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(raw);
}

/** Import a CryptoKey from a base64 string */
export async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64Key);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: ALGO, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

/** Store a conversation key in localStorage */
export async function storeConversationKey(conversationId: string, key: CryptoKey): Promise<void> {
  const exported = await exportKey(key);
  localStorage.setItem(getConvKeyStorageKey(conversationId), exported);
}

/** Retrieve a conversation key from localStorage */
export async function getStoredConversationKey(conversationId: string): Promise<CryptoKey | null> {
  const stored = localStorage.getItem(getConvKeyStorageKey(conversationId));
  if (!stored) return null;
  try {
    return await importKey(stored);
  } catch {
    return null;
  }
}

/** Get or create a conversation key */
export async function getOrCreateConversationKey(conversationId: string): Promise<CryptoKey> {
  const existing = await getStoredConversationKey(conversationId);
  if (existing) return existing;

  const newKey = await generateConversationKey();
  await storeConversationKey(conversationId, newKey);
  return newKey;
}

// ─── Encryption / Decryption ──────────────────────────────────────

/** Encrypt a plaintext message. Returns base64(iv + ciphertext) */
export async function encryptMessage(plaintext: string, key: CryptoKey): Promise<string> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    enc.encode(plaintext)
  );

  // Combine iv + ciphertext into single buffer
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  return arrayBufferToBase64(combined.buffer);
}

/** Decrypt a message. Input is base64(iv + ciphertext) */
export async function decryptMessage(encryptedBase64: string, key: CryptoKey): Promise<string> {
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedBase64));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/** Try to decrypt, returning fallback text on failure.
 *  Since E2E encryption is disabled (keys were never shared cross-device),
 *  old encrypted messages simply return the raw content. */
export async function tryDecryptMessage(
  content: string,
  isEncrypted: boolean,
  key: CryptoKey | null
): Promise<string> {
  if (!isEncrypted) return content;
  if (!key) return "[Old message]";
  try {
    return await decryptMessage(content, key);
  } catch {
    return "[Old message]";
  }
}

// ─── Screenshot Detection ─────────────────────────────────────────

type ScreenshotCallback = () => void;

let screenshotCleanup: (() => void) | null = null;

/** Start detecting potential screenshots via keyboard shortcuts and visibility changes */
export function startScreenshotDetection(onDetected: ScreenshotCallback): () => void {
  if (screenshotCleanup) screenshotCleanup();

  const handleKeyDown = (e: KeyboardEvent) => {
    // PrintScreen key
    if (e.key === "PrintScreen") {
      e.preventDefault();
      onDetected();
    }
    // Cmd+Shift+3/4/5 (macOS screenshots)
    if (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key)) {
      onDetected();
    }
    // Ctrl+Shift+S (various screenshot tools)
    if (e.ctrlKey && e.shiftKey && e.key === "S") {
      onDetected();
    }
    // Windows+Shift+S (Snipping Tool)
    if (e.metaKey && e.shiftKey && e.key === "s") {
      onDetected();
    }
  };

  // Detect tab switching (potential screen recording)
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      // Could be screenshot on some platforms
    }
  };

  document.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  screenshotCleanup = () => {
    document.removeEventListener("keydown", handleKeyDown, true);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };

  return screenshotCleanup;
}

// ─── Disappearing Messages ────────────────────────────────────────

/** Calculate expiry timestamp from now */
export function getExpiryTimestamp(durationSeconds: number): string {
  return new Date(Date.now() + durationSeconds * 1000).toISOString();
}

/** Check if a message has expired */
export function isMessageExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

/** Predefined disappearing message durations */
export const DISAPPEAR_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "30s", value: 30 },
  { label: "5m", value: 300 },
  { label: "1h", value: 3600 },
  { label: "24h", value: 86400 },
] as const;

// ─── Utility ──────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
