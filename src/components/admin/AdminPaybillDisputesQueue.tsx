import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Scale, RefreshCw, Search, Upload, FileText, Image as ImageIcon,
  CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, Download, FileDown, BellRing,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/use-user-roles";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MANAGE_ROLES = new Set(["admin", "finance", "compliance", "risk"]);
const EXPORT_ROLES = new Set(["admin", "audit", "compliance", "finance"]);

type Row = {
  id: string;
  transaction_id: string;
  status: string;
  amount: number | null;
  provider_ref: string | null;
  dispute_status: string;
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  dispute_opened_by: string | null;
  dispute_resolved_at: string | null;
  dispute_resolved_by: string | null;
  dispute_evidence_due_at: string | null;
  dispute_resolution_due_at: string | null;
  dispute_sla_alerted_at: string | null;
  created_at: string;
};

type Evidence = {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  note: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  disputed:          "bg-amber-500/15 text-amber-600",
  evidence_pending:  "bg-amber-500/15 text-amber-600",
  evidence_received: "bg-blue-500/15 text-blue-600",
  resolved:          "bg-emerald-500/15 text-emerald-600",
  rejected:          "bg-red-500/15 text-red-500",
};

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
function download(name: string, data: Blob) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function slaBadge(row: Row): { label: string; cls: string; overdue: boolean } | null {
  if (!["disputed", "evidence_pending", "evidence_received"].includes(row.dispute_status)) return null;
  const now = Date.now();
  const res = row.dispute_resolution_due_at ? new Date(row.dispute_resolution_due_at).getTime() : null;
  const ev = row.dispute_evidence_due_at ? new Date(row.dispute_evidence_due_at).getTime() : null;
  if (res && now > res) return { label: "Resolution overdue", cls: "bg-red-500/15 text-red-600", overdue: true };
  if (ev && now > ev && row.dispute_status !== "evidence_received")
    return { label: "Evidence overdue", cls: "bg-red-500/15 text-red-600", overdue: true };
  if (res) return { label: `Res in ${formatDistanceToNow(new Date(res))}`, cls: "bg-slate-500/15 text-slate-500", overdue: false };
  return null;
}

export default function AdminPaybillDisputesQueue() {
  const { roles } = useUserRoles();
  const canManage = roles.some((r) => MANAGE_ROLES.has(r));
  const canExport = roles.some((r) => EXPORT_ROLES.has(r));

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [selected, setSelected] = useState<Row | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("biller_settlements")
      .select("id, transaction_id, status, amount, provider_ref, dispute_status, dispute_reason, dispute_opened_at, dispute_opened_by, dispute_resolved_at, dispute_resolved_by, dispute_evidence_due_at, dispute_resolution_due_at, dispute_sla_alerted_at, created_at")
      .neq("dispute_status", "none")
      .order("dispute_opened_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = (supabase as any)
      .channel("dispute-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "biller_settlements" }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter === "open" && !["disputed","evidence_pending","evidence_received"].includes(r.dispute_status)) return false;
    if (statusFilter === "closed" && !["resolved","rejected"].includes(r.dispute_status)) return false;
    if (statusFilter !== "open" && statusFilter !== "closed" && statusFilter !== "all" && r.dispute_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.provider_ref ?? "").toLowerCase().includes(q) ||
             r.id.toLowerCase().includes(q) ||
             (r.transaction_id ?? "").toLowerCase().includes(q) ||
             (r.dispute_reason ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [rows, search, statusFilter]);

  const openDetails = async (row: Row) => {
    setSelected(row);
    setNote("");
    setFile(null);
    setPreviewUrl(null);
    setResolveNote("");
    setEvidenceLoading(true);
    setEvidence([]);
    setSignedUrls({});
    const { data, error } = await (supabase as any)
      .from("dispute_evidence").select("*")
      .eq("settlement_id", row.id).order("uploaded_at", { ascending: false });
    if (error) toast.error(error.message);
    const evs = (data as Evidence[]) ?? [];
    setEvidence(evs);
    // Sign URLs
    const urls: Record<string, string> = {};
    for (const e of evs) {
      const { data: s } = await supabase.storage.from("dispute-evidence").createSignedUrl(e.file_path, 3600);
      if (s?.signedUrl) urls[e.id] = s.signedUrl;
    }
    setSignedUrls(urls);
    setEvidenceLoading(false);
  };

  const onPickFile = (f: File | null) => {
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const submitEvidence = async () => {
    if (!selected) return;
    if (!note.trim() && !file) { toast.error("Add a note or a file"); return; }
    setBusy(true);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      let mime: string | null = null;
      let size: number | null = null;
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        filePath = `${selected.id}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from("dispute-evidence")
          .upload(filePath, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        fileName = file.name; mime = file.type; size = file.size;
      }
      const { error } = await (supabase as any).rpc("admin_submit_dispute_evidence", {
        p_settlement_id: selected.id,
        p_note: note || "(no note)",
        p_file_path: filePath,
        p_file_name: fileName,
        p_mime_type: mime,
        p_file_size: size,
      });
      if (error) throw error;
      toast.success("Evidence submitted");
      await openDetails(selected);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setBusy(false); }
  };

  const resolveDispute = async (outcome: "resolved" | "rejected") => {
    if (!selected) return;
    if (!resolveNote.trim()) { toast.error("Add a resolution note"); return; }
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("admin_resolve_paybill_dispute", {
        p_settlement_id: selected.id,
        p_outcome: outcome,
        p_note: resolveNote,
      });
      if (error) throw error;
      toast.success(`Dispute ${outcome}`);
      setSelected(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to resolve");
    } finally { setBusy(false); }
  };

  const runSlaCheck = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("check_paybill_dispute_sla_breaches");
      if (error) throw error;
      toast.success(`SLA scan: ${data?.breaches_alerted ?? 0} alert(s) sent`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "SLA scan failed");
    } finally { setBusy(false); }
  };

  const exportCsv = () => {
    if (!canExport) { toast.error("No permission"); return; }
    if (!filtered.length) { toast.info("Nothing to export"); return; }
    const rowsOut = filtered.map((r) => ({
      settlement_id: r.id,
      transaction_id: r.transaction_id,
      amount: r.amount,
      status: r.status,
      dispute_status: r.dispute_status,
      reason: r.dispute_reason,
      opened_at: r.dispute_opened_at,
      evidence_due: r.dispute_evidence_due_at,
      resolution_due: r.dispute_resolution_due_at,
      resolved_at: r.dispute_resolved_at,
      provider_ref: r.provider_ref,
    }));
    download(`paybill-disputes-${new Date().toISOString().slice(0,10)}.csv`,
      new Blob([toCsv(rowsOut)], { type: "text/csv;charset=utf-8" }));
    toast.success(`Exported ${rowsOut.length} rows`);
  };

  const exportPdf = () => {
    if (!canExport) { toast.error("No permission"); return; }
    if (!filtered.length) { toast.info("Nothing to export"); return; }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Paybill Dispute Report", 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated ${format(new Date(), "PPpp")} · ${filtered.length} disputes`, 14, 20);
    autoTable(doc, {
      startY: 26, styles: { fontSize: 7 }, headStyles: { fillColor: [30, 41, 59] },
      head: [["Settlement", "Txn", "Amount", "Status", "Reason", "Opened", "Evidence Due", "Resolution Due", "Resolved"]],
      body: filtered.map((r) => [
        r.id.slice(0, 8), (r.transaction_id ?? "").slice(0, 8), r.amount ?? "-",
        r.dispute_status, (r.dispute_reason ?? "").slice(0, 40),
        r.dispute_opened_at ? format(new Date(r.dispute_opened_at), "MMM d HH:mm") : "-",
        r.dispute_evidence_due_at ? format(new Date(r.dispute_evidence_due_at), "MMM d HH:mm") : "-",
        r.dispute_resolution_due_at ? format(new Date(r.dispute_resolution_due_at), "MMM d HH:mm") : "-",
        r.dispute_resolved_at ? format(new Date(r.dispute_resolved_at), "MMM d HH:mm") : "-",
      ]),
    });
    doc.save(`paybill-disputes-${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success("PDF exported");
  };

  const openCount = rows.filter((r) => ["disputed","evidence_pending","evidence_received"].includes(r.dispute_status)).length;
  const overdueCount = rows.filter((r) => slaBadge(r)?.overdue).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Scale size={18} className="text-amber-500" /> Paybill Disputes Queue
          </h2>
          <p className="text-xs text-muted-foreground">Upload evidence, track SLAs, and resolve paybill disputes in one place.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={runSlaCheck} disabled={busy || !canManage}>
            <BellRing size={14} className="mr-1" /> Scan SLA
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!canExport}>
            <Download size={14} className="mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={exportPdf} disabled={!canExport}>
            <FileDown size={14} className="mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Total disputes</p>
          <p className="text-xl font-bold">{rows.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Open</p>
          <p className="text-xl font-bold text-amber-600">{openCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">SLA overdue</p>
          <p className="text-xl font-bold text-red-600">{overdueCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Resolved</p>
          <p className="text-xl font-bold text-emerald-600">
            {rows.filter((r) => r.dispute_status === "resolved").length}
          </p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open (all)</SelectItem>
            <SelectItem value="evidence_pending">Evidence pending</SelectItem>
            <SelectItem value="evidence_received">Evidence received</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="closed">Closed (all)</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference / txn / reason" className="h-8 text-xs pl-7" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No disputes match the current filter.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const sla = slaBadge(r);
            return (
              <Card key={r.id} className="cursor-pointer hover:bg-muted/40 transition" onClick={() => openDetails(r)}>
                <CardContent className="p-3 text-xs flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      ৳{r.amount ?? "-"} · {r.provider_ref ?? r.id.slice(0, 8)}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.dispute_reason ?? "No reason"} · opened {r.dispute_opened_at ? format(new Date(r.dispute_opened_at), "MMM d, HH:mm") : "-"}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <Badge className={STATUS_STYLE[r.dispute_status] ?? "bg-slate-500/15 text-slate-500"}>
                      {r.dispute_status.replace("_", " ")}
                    </Badge>
                    {sla && (
                      <Badge className={`${sla.cls} gap-1`}>
                        {sla.overdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
                        {sla.label}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90svh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Scale size={16} /> Dispute · {selected.provider_ref ?? selected.id.slice(0, 8)}
                </DialogTitle>
                <DialogDescription>
                  ৳{selected.amount ?? "-"} · {selected.dispute_reason ?? "No reason"}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_STYLE[selected.dispute_status]}>{selected.dispute_status}</Badge></div>
                <div><span className="text-muted-foreground">Opened:</span> {selected.dispute_opened_at ? format(new Date(selected.dispute_opened_at), "PPpp") : "-"}</div>
                <div><span className="text-muted-foreground">Evidence due:</span> {selected.dispute_evidence_due_at ? format(new Date(selected.dispute_evidence_due_at), "PPpp") : "-"}</div>
                <div><span className="text-muted-foreground">Resolution due:</span> {selected.dispute_resolution_due_at ? format(new Date(selected.dispute_resolution_due_at), "PPpp") : "-"}</div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1"><FileText size={14} /> Evidence ({evidence.length})</p>
                {evidenceLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : evidence.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No evidence uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {evidence.map((e) => {
                      const url = signedUrls[e.id];
                      const isImg = (e.mime_type ?? "").startsWith("image/");
                      return (
                        <div key={e.id} className="border rounded p-2 text-xs space-y-1">
                          <div className="flex justify-between gap-2 items-center">
                            <span className="font-medium truncate flex items-center gap-1">
                              {isImg ? <ImageIcon size={12} /> : <FileText size={12} />}
                              {e.file_name}
                            </span>
                            {url && (
                              <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">Open</a>
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            {e.note} · {format(new Date(e.uploaded_at), "MMM d, HH:mm")}
                          </p>
                          {isImg && url && (
                            <img src={url} alt={e.file_name} className="max-h-48 rounded border object-contain" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {canManage && ["disputed","evidence_pending","evidence_received"].includes(selected.dispute_status) && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-semibold flex items-center gap-1"><Upload size={14} /> Submit evidence</p>
                  <Label className="text-xs">Note</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Describe the evidence" />
                  <Label className="text-xs">File (image or PDF)</Label>
                  <Input type="file" accept="image/*,application/pdf" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
                  {previewUrl && (
                    <img src={previewUrl} alt="Preview" className="max-h-40 rounded border object-contain" />
                  )}
                  <Button size="sm" onClick={submitEvidence} disabled={busy}>
                    {busy ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
                    Submit
                  </Button>
                </div>
              )}

              {canManage && ["evidence_received","evidence_pending","disputed"].includes(selected.dispute_status) && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-semibold">Resolve dispute</p>
                  <Textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} rows={2} placeholder="Resolution notes (required)" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => resolveDispute("resolved")} disabled={busy || selected.dispute_status !== "evidence_received"}
                      title={selected.dispute_status !== "evidence_received" ? "Submit evidence first" : ""}>
                      <CheckCircle2 size={14} className="mr-1" /> Mark Resolved
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => resolveDispute("rejected")} disabled={busy}>
                      <XCircle size={14} className="mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
