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

export function getSeedContacts(): StoredContact[] {
  return [];
}

export function getContactsWithFallback(): StoredContact[] {
  return loadContacts();
}

// ── Shared UI mapper ─────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-orange-100 text-orange-700",
  "bg-cyan-100 text-cyan-700",
];

export interface ContactUI {
  id: string;
  name: string;
  phone: string;
  initials: string;
  colorClass: string;
}

export function mapStoredContactsToUI(contacts: StoredContact[]): ContactUI[] {
  return contacts.map((c, i) => {
    const parts = c.name.trim().split(/\s+/);
    const initials = (parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0])
      : c.name.slice(0, 2)
    ).toUpperCase();
    return {
      id: `contact-${c.phone}`,
      name: c.name,
      phone: c.phone,
      initials,
      colorClass: AVATAR_COLORS[i % AVATAR_COLORS.length],
    };
  });
}
