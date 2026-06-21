import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Plus, Pencil, Trash2, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

interface SavedAddress {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  area: string | null;
  is_default: boolean;
}

interface AddressManagerProps {
  userId: string;
  onSelect?: (address: SavedAddress) => void;
  selectedId?: string;
  compact?: boolean;
}

const LABEL_OPTIONS = ["Home", "Office", "Other"];

export default function AddressManager({ userId, onSelect, selectedId, compact }: AddressManagerProps) {
  const { t } = useI18n();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: "Home", recipient_name: "", phone: "", address_line: "", city: "", area: "", is_default: false,
  });

  const labelKey = (label: string) => {
    if (label === "Home") return "amLabelHome" as const;
    if (label === "Office") return "amLabelOffice" as const;
    return "amLabelOther" as const;
  };

  const fetchAddresses = async () => {
    const { data } = await supabase
      .from("delivery_addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setAddresses((data as SavedAddress[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchAddresses(); }, [userId]);

  const openEdit = (addr: SavedAddress | "new") => {
    if (addr === "new") {
      setForm({ label: "Home", recipient_name: "", phone: "", address_line: "", city: "", area: "", is_default: addresses.length === 0 });
    } else {
      setForm({
        label: addr.label, recipient_name: addr.recipient_name, phone: addr.phone,
        address_line: addr.address_line, city: addr.city, area: addr.area || "",
        is_default: addr.is_default,
      });
    }
    setEditing(addr);
  };

  const handleSave = async () => {
    if (!form.recipient_name || !form.phone || !form.address_line || !form.city) {
      toast.error(t("amFillRequired"));
      return;
    }
    setSaving(true);
    try {
      // If setting as default, clear others
      if (form.is_default) {
        await supabase.from("delivery_addresses").update({ is_default: false } as any).eq("user_id", userId);
      }

      if (editing === "new") {
        const { error } = await supabase.from("delivery_addresses").insert({
          user_id: userId, label: form.label, recipient_name: form.recipient_name,
          phone: form.phone, address_line: form.address_line, city: form.city,
          area: form.area || null, is_default: form.is_default,
        });
        if (error) throw error;
        toast.success(t("amAddressSaved"));
      } else if (editing) {
        const { error } = await supabase.from("delivery_addresses").update({
          label: form.label, recipient_name: form.recipient_name, phone: form.phone,
          address_line: form.address_line, city: form.city,
          area: form.area || null, is_default: form.is_default,
        } as any).eq("id", editing.id);
        if (error) throw error;
        toast.success(t("amAddressUpdated"));
      }
      setEditing(null);
      fetchAddresses();
    } catch (e: any) {
      toast.error(e.message || t("amSaveFailed"));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("delivery_addresses").delete().eq("id", id);
    setAddresses(prev => prev.filter(a => a.id !== id));
    toast.success(t("amAddressDeleted"));
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Address List */}
      {addresses.map(addr => (
        <motion.div
          key={addr.id}
          layout
          className={`relative bg-card rounded-xl border p-3 flex items-start gap-3 cursor-pointer transition-colors ${
            selectedId === addr.id ? "border-primary bg-primary/5" : "border-border"
          }`}
          onClick={() => onSelect?.(addr)}
        >
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-foreground">{t(labelKey(addr.label))}</span>
              {addr.is_default && (
                <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t("amDefault")}</span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5">{addr.recipient_name} · {addr.phone}</p>
            <p className="text-[11px] text-muted-foreground truncate">{addr.address_line}, {addr.area ? `${addr.area}, ` : ""}{addr.city}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(addr); }}>
              <Pencil className="w-3 h-3" />
            </Button>
            {!compact && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(addr.id); }}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          {selectedId === addr.id && (
            <Check className="w-4 h-4 text-primary absolute top-3 right-3" />
          )}
        </motion.div>
      ))}

      {/* Add New Button */}
      <button
        onClick={() => openEdit("new")}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border text-muted-foreground bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span className="text-[13px] font-semibold">{t("amAddNew")}</span>
      </button>

      {/* Edit Form Modal */}
      <AnimatePresence>
        {editing !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col justify-end"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative bg-background rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto pb-10"
            >
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-2" />
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-foreground">{editing === "new" ? "New Address" : "Edit Address"}</p>
                <Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
              </div>

              {/* Label chips */}
              <div className="flex gap-2">
                {LABEL_OPTIONS.map(l => (
                  <button key={l} onClick={() => setForm(f => ({ ...f, label: l }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      form.label === l ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"
                    }`}>{l}</button>
                ))}
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Full Name *</Label>
                  <Input value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))} placeholder="e.g. Karim Hossain" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone *</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 01712-345678" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Address Line *</Label>
                  <Input value={form.address_line} onChange={e => setForm(f => ({ ...f, address_line: e.target.value }))} placeholder="House/Flat, Road, Block" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Area / Thana</Label>
                    <Input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Mirpur-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">City *</Label>
                    <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Dhaka" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                    className="rounded border-border" />
                  <span className="text-xs text-foreground">Set as default address</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Address
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
