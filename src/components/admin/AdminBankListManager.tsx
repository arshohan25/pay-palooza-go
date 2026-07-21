import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Landmark, Plus, Trash2, Search, Upload, X, Loader2, GripVertical, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePlatformBanks, PlatformBank } from "@/hooks/use-platform-banks";
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "platform_bank", entity_id: entityId, details
    }).then();
  }
}

// Signed URLs max 1 year. Store the URL directly.
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

async function uploadLogoAndGetUrl(file: File, bankId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${bankId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("bank-logos")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" });
  if (upErr) throw upErr;
  const { data, error: signErr } = await supabase.storage
    .from("bank-logos")
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Sign failed");
  return data.signedUrl;
}

function BankLogoUploader({ bank, onChanged }: { bank: PlatformBank; onChanged: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error("Logo must be under 500KB");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadLogoAndGetUrl(file, bank.id);
      const { error } = await supabase.from("platform_banks").update({ logo_url: url } as any).eq("id", bank.id);
      if (error) throw error;
      auditLog("upload_bank_logo", bank.id, { name: bank.name });
      toast.success(`Logo updated for ${bank.name}`);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearLogo = async () => {
    if (!confirm(`Remove logo for ${bank.name}?`)) return;
    await supabase.from("platform_banks").update({ logo_url: null } as any).eq("id", bank.id);
    auditLog("remove_bank_logo", bank.id, { name: bank.name });
    toast.success("Logo removed");
    onChanged();
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <Button
        size="icon"
        variant="ghost"
        className="w-7 h-7 text-muted-foreground hover:text-primary"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        title={bank.logo_url ? "Replace logo" : "Upload logo"}
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
      </Button>
      {bank.logo_url && (
        <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={clearLogo} title="Remove logo">
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

export default function AdminBankListManager() {
  const { banks, loading, refetch } = usePlatformBanks(true);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = banks.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.short_code.toLowerCase().includes(search.toLowerCase())
  );

  const addBank = async () => {
    if (!newName.trim() || !newCode.trim()) {
      toast.error("Bank name and short code are required");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("platform_banks").insert({
      name: newName.trim(),
      short_code: newCode.trim().toUpperCase(),
      sort_order: banks.length + 1,
    } as any);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Bank already exists" : error.message);
    } else {
      toast.success("Bank added");
      auditLog("create_bank", "new", { name: newName.trim(), short_code: newCode.trim().toUpperCase() });
      setNewName("");
      setNewCode("");
      refetch();
    }
    setAdding(false);
  };

  const toggleBank = async (id: string, active: boolean) => {
    await supabase.from("platform_banks").update({ is_active: !active } as any).eq("id", id);
    auditLog("toggle_bank", id, { is_active: !active });
    toast.success(!active ? "Bank activated" : "Bank deactivated");
    refetch();
  };

  const deleteBank = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await supabase.from("platform_banks").delete().eq("id", id);
    auditLog("delete_bank", id, { name });
    toast.success("Bank deleted");
    refetch();
  };

  const persistOrder = async (ordered: PlatformBank[]) => {
    // Assign sequential sort_order starting at 1
    const updates = ordered.map((b, idx) => ({ id: b.id, sort_order: idx + 1 }));
    // Perform in parallel; small list
    const results = await Promise.all(
      updates.map(u => supabase.from("platform_banks").update({ sort_order: u.sort_order } as any).eq("id", u.id))
    );
    const failed = results.find(r => r.error);
    if (failed?.error) {
      toast.error("Failed to save order");
      refetch();
      return;
    }
    auditLog("reorder_banks", "bulk", { count: ordered.length });
    toast.success("Order saved");
    refetch();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Only reorder when not filtering (would be ambiguous)
    if (search.trim()) {
      toast.info("Clear search to reorder");
      return;
    }
    const oldIndex = banks.findIndex(b => b.id === active.id);
    const newIndex = banks.findIndex(b => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(banks, oldIndex, newIndex);
    persistOrder(next);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Landmark className="w-5 h-5 text-primary" /> Platform Bank List
      </h3>

      {/* Add new bank */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Add New Bank</p>
          <div className="flex gap-2">
            <Input placeholder="Bank name" value={newName} onChange={e => setNewName(e.target.value)} className="h-10 rounded-lg flex-1" />
            <Input placeholder="Code" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} className="h-10 rounded-lg w-24" maxLength={8} />
            <Button size="sm" onClick={addBank} disabled={adding} className="h-10 px-4 rounded-lg">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">After adding, upload a logo and drag rows to reorder.</p>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search banks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-lg" />
      </div>

      {/* Bank list */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0 max-h-[400px] overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border/50">
                {filtered.map(b => (
                  <SortableBankRow
                    key={b.id}
                    bank={b}
                    disabled={!!search.trim()}
                    onToggle={() => toggleBank(b.id, b.is_active)}
                    onDelete={() => deleteBank(b.id, b.name)}
                    onLogoChanged={refetch}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {!loading && filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No banks found</p>}
        </CardContent>
      </Card>
      <p className="text-[10px] text-muted-foreground text-center">
        {banks.length} banks · {banks.filter(b => b.is_active).length} active · {banks.filter(b => b.logo_url).length} with logos · drag <GripVertical className="inline w-3 h-3" /> to reorder
      </p>
    </div>
  );
}

function SortableBankRow({
  bank, disabled, onToggle, onDelete, onLogoChanged,
}: {
  bank: PlatformBank;
  disabled: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onLogoChanged: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bank.id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : "auto",
    opacity: isDragging ? 0.85 : 1,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between px-3 py-3 hover:bg-muted/30 gap-2 bg-card">
      <button
        {...attributes}
        {...listeners}
        className={`touch-none shrink-0 p-1 -ml-1 rounded ${disabled ? "opacity-30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"}`}
        aria-label="Drag to reorder"
        disabled={disabled}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {bank.logo_url ? (
          <div className="w-9 h-9 rounded-lg bg-white border border-border/40 overflow-hidden shrink-0 flex items-center justify-center">
            <img src={bank.logo_url} alt={bank.name} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">{bank.short_code.slice(0, 3)}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{bank.name}</p>
          <p className="text-[10px] text-muted-foreground">#{bank.sort_order} · {bank.short_code}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <BankLogoUploader bank={bank} onChanged={onLogoChanged} />
        <Badge variant={bank.is_active ? "default" : "secondary"} className="text-[10px]">
          {bank.is_active ? "On" : "Off"}
        </Badge>
        <Switch checked={bank.is_active} onCheckedChange={onToggle} />
        <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive/70 hover:text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

