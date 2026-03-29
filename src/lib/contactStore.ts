const STORAGE_KEY = "ezypay_phone_contacts";

export interface StoredContact {
  name: string;
  phone: string;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, "");
}

export function loadContacts(): StoredContact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredContact[];
  } catch {
    return [];
  }
}

export function saveContacts(contacts: StoredContact[]): StoredContact[] {
  const existing = loadContacts();
  const seen = new Set(existing.map((c) => normalizePhone(c.phone)));
  const merged = [...existing];
  for (const c of contacts) {
    const key = normalizePhone(c.phone);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ name: c.name, phone: key });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export function clearContacts(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasStoredContacts(): boolean {
  return loadContacts().length > 0;
}
