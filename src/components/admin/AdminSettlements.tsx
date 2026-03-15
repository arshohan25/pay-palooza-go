import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Landmark, Plus, CheckCircle, Clock, XCircle, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

interface Settlement {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  entity_phone: string | null;
  period_start: string;
  period_end: string;
  gross_amount: number;
  fee_amount: number;
  commission_amount: number;
  net_amount: number;
  txn_count: number;
  status: string;
  bank_name: string | null;
  bank_account: string | null;
  settlement_ref: string | null;
  notes: string | null;
  settled_at: string | null;
  created_at: string;
}

export default function AdminSettlements() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "merchant" | "agent">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ entityType: "merchant", entityPhone: "", periodStart: "", periodEnd: "", bankName: "", bankAccount: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("settlements").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("entity_type", filter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    setSettlements((data as Settlement[]) ?? []);
    setLoading(false);
  }, [filter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("settlements-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const handleCreate = async () => {
    if (!form.entityPhone || !form.periodStart || !form.periodEnd) {
      toast.error("Fill required fields"); return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Find entity by phone
      let entityId: string | null = null;
      let entityName: string | null = null;
      if (form.entityType === "merchant") {
        const { data: prof } = await supabase.from("profiles").select("user_id, name").eq("phone", form.entityPhone).maybeSingle();
        if (!prof) throw new Error("Phone not found");
        const { data: merchant } = await supabase.from("merchants").select("id, business_name").eq("user_id", prof.user_id).maybeSingle();
        if (!merchant) throw new Error("No merchant found for this phone");
        entityId = merchant.id;
        entityName = merchant.business_name;
      } else {
        const { data: prof } = await supabase.from("profiles").select("user_id, name").eq("phone", form.entityPhone).maybeSingle();
        if (!prof) throw new Error("Phone not found");
        const { data: agent } = await supabase.from("agents").select("id, business_name").eq("user_id", prof.user_id).maybeSingle();
        if (!agent) throw new Error("No agent found for this phone");
        entityId = agent.id;
        entityName = agent.business_name || prof.name;
      }

      // Calculate from transactions in period
      const periodStart = new Date(form.periodStart).toISOString();
      const periodEnd = new Date(form.periodEnd).toISOString();

      // Get the user_id for querying transactions
      const { data: entityProfile } = await supabase.from("profiles").select("user_id").eq("phone", form.entityPhone).maybeSingle();
      const txnTypes = form.entityType === "merchant" ? ["payment"] : ["cashin", "cashout"];
      const { data: txns } = await supabase.from("transactions")
        .select("amount, fee, commission")
        .eq("user_id", entityProfile?.user_id ?? "")
        .eq("status", "completed")
        .in("type", txnTypes)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd);

      const gross = (txns ?? []).reduce((s, t) => s + Number(t.amount), 0);
      const fees = (txns ?? []).reduce((s, t) => s + Number(t.fee), 0);
      const comms = (txns ?? []).reduce((s, t) => s + Number(t.commission), 0);
      const net = gross - fees + comms;

      const ref = `STL-${Date.now().toString(36).toUpperCase()}`;

      const { error } = await supabase.from("settlements").insert({
        entity_type: form.entityType,
        entity_id: entityId,
        entity_name: entityName,
        entity_phone: form.entityPhone,
        period_start: periodStart,
        period_end: periodEnd,
        gross_amount: gross,
        fee_amount: fees,
        commission_amount: comms,
        net_amount: net,
        txn_count: txns?.length ?? 0,
        status: "pending",
        bank_name: form.bankName || null,
        bank_account: form.bankAccount || null,
        settlement_ref: ref,
        notes: form.notes || null,
        settled_by: session?.user?.id,
      } as any);

      if (error) throw error;
      toast.success(`Settlement ${ref} created — ৳${net.toLocaleString()} net`);
      setShowCreate(false);
      setForm({ entityType: "merchant", entityPhone: "", periodStart: "", periodEnd: "", bankName: "", bankAccount: "", notes: "" });
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create settlement");
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const update: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "completed") update.settled_at = new Date().toISOString();
    const { error } = await supabase.from("settlements").update(update).eq("id", id);
    if (error) toast.error("Failed to update");
    else { toast.success(`Settlement marked ${newStatus}`); load(); }
  };

  const exportCSV = () => {
    const headers = ["Ref", "Type", "Name", "Phone", "Gross", "Fees", "Commission", "Net", "Txns", "Status", "Period", "Created"];
    const rows = filtered.map(s => [
      s.settlement_ref || "", s.entity_type, s.entity_name || "", s.entity_phone || "",
      s.gross_amount, s.fee_amount, s.commission_amount, s.net_amount, s.txn_count,
      s.status, `${s.period_start?.slice(0, 10)} - ${s.period_end?.slice(0, 10)}`, s.created_at?.slice(0, 10),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `settlements-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = settlements.filter(s => !search || s.entity_name?.toLowerCase().includes(search.toLowerCase()) || s.entity_phone?.includes(search) || s.settlement_ref?.includes(search));

  const totalPending = settlements.filter(s => s.status === "pending").reduce((sum, s) => sum + Number(s.net_amount), 0);
  const totalCompleted = settlements.filter(s => s.status === "completed").reduce((sum, s) => sum + Number(s.net_amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" /> Settlement System
          </h3>
          <p className="text-sm text-muted-foreground">Manage merchant & agent batch settlements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> Export</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> New Settlement</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Settlements</p><p className="text-xl font-bold text-foreground">{settlements.length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Pending Payout</p><p className="text-xl font-bold text-amber-600">৳{totalPending.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-bold text-emerald-600">৳{totalCompleted.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">This Month</p><p className="text-xl font-bold text-foreground">{settlements.filter(s => new Date(s.created_at).getMonth() === new Date().getMonth()).length}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="merchant">Merchant</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, phone, ref…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-center">Txns</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No settlements found</TableCell></TableRow>
                ) : filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.settlement_ref || s.id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs capitalize">{s.entity_type}</Badge></TableCell>
                    <TableCell>
                      <div><p className="text-sm font-medium text-foreground">{s.entity_name || "—"}</p><p className="text-xs text-muted-foreground">{s.entity_phone}</p></div>
                    </TableCell>
                    <TableCell className="text-right font-mono">৳{Number(s.gross_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono font-bold">৳{Number(s.net_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-center">{s.txn_count}</TableCell>
                    <TableCell><Badge className={`text-xs ${STATUS_COLORS[s.status] ?? ""}`}>{s.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.period_start?.slice(0, 10)} → {s.period_end?.slice(0, 10)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {s.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(s.id, "processing")}>Process</Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => updateStatus(s.id, "failed")}>Fail</Button>
                          </>
                        )}
                        {s.status === "processing" && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => updateStatus(s.id, "completed")}><CheckCircle className="w-3 h-3 mr-1" /> Complete</Button>
                        )}
                        {s.status === "completed" && <span className="text-xs text-muted-foreground">{s.settled_at ? formatDistanceToNow(new Date(s.settled_at), { addSuffix: true }) : "—"}</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Settlement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Entity Type</Label>
              <Select value={form.entityType} onValueChange={v => setForm(f => ({ ...f, entityType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="merchant">Merchant</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input placeholder="01XXXXXXXXX" value={form.entityPhone} onChange={e => setForm(f => ({ ...f, entityPhone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Period Start</Label><Input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} /></div>
              <div><Label>Period End</Label><Input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} /></div>
            </div>
            <div><Label>Bank Name</Label><Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} /></div>
            <div><Label>Bank Account</Label><Input value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Calculate & Create Settlement"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
