import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock, CheckCircle, XCircle, Search, Store, Loader2, User, FileText, RefreshCw, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMerchantCategories } from "@/hooks/use-merchant-categories";
import AdminApprovalTemplatePreview from "@/components/admin/AdminApprovalTemplatePreview";

interface Application {
  id: string;
  user_id: string;
  business_name: string;
  category: string;
  trade_license: string | null;
  owner_name: string | null;
  contact_number: string | null;
  contact_email: string | null;
  business_address: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_routing: string | null;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  // joined
  applicant_name?: string;
  applicant_phone?: string;
}

export default function AdminMerchantApplications() {
  const { getLabelForName } = useMerchantCategories();
  const [view, setView] = useState<"applications" | "templates">("applications");
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("merchant_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch applicant profiles
      const userIds = Array.from(new Set(data.map((a: any) => String(a.user_id))));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", userIds as string[]);

      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
      const enriched = data.map((a: any) => ({
        ...a,
        applicant_name: profileMap.get(a.user_id)?.name || a.owner_name || "Unknown",
        applicant_phone: a.contact_number || profileMap.get(a.user_id)?.phone || "",
      }));
      setApps(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("admin-merchant-apps-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_applications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = apps.filter(a => {
    if (filter !== "all" && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.business_name.toLowerCase().includes(q) || a.applicant_name?.toLowerCase().includes(q) || a.applicant_phone?.includes(q);
    }
    return true;
  });

  const pendingCount = apps.filter(a => a.status === "pending").length;

  const handleAction = async (app: Application, action: "approved" | "rejected") => {
    setProcessing(app.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setProcessing(null); return; }

    // Update application
    const { error } = await (supabase as any).from("merchant_applications").update({
      status: action,
      admin_notes: adminNotes[app.id] || null,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", app.id);

    if (error) { toast.error("Failed: " + error.message); setProcessing(null); return; }

    if (action === "approved") {
      // Create merchant record
      const { error: mErr } = await supabase.from("merchants").insert({
        user_id: app.user_id,
        business_name: app.business_name,
        category: app.category as any,
        trade_license: app.trade_license,
        bank_name: app.bank_name,
        bank_account_number: app.bank_account_number,
        bank_routing: app.bank_routing,
        status: "active" as any,
      });
      if (mErr) { toast.error("Merchant creation failed: " + mErr.message); setProcessing(null); return; }

      // Assign merchant role
      await supabase.from("user_roles").insert({ user_id: app.user_id, role: "merchant" as any });
    }

    // Notify user
    await supabase.from("notifications").insert({
      user_id: app.user_id,
      title: action === "approved" ? "Merchant Application Approved! 🎉" : "Merchant Application Update",
      body: action === "approved"
        ? `Your merchant account "${app.business_name}" has been approved. You can now accept payments!`
        : `Your merchant application was rejected.${adminNotes[app.id] ? ` Reason: ${adminNotes[app.id]}` : ""}`,
      category: "merchant",
    });

    // Audit
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: `merchant_application_${action}`,
      entity_type: "merchant_application",
      entity_id: app.id,
      details: { business_name: app.business_name, user_id: app.user_id, notes: adminNotes[app.id] || null },
    });

    toast.success(`Application ${action}`);
    setProcessing(null);
    setAdminNotes(prev => { const n = { ...prev }; delete n[app.id]; return n; });
    load();
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300">Pending</Badge>;
    if (status === "approved") return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Approved</Badge>;
    return <Badge variant="destructive">Rejected</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="inline-flex p-1 rounded-xl bg-muted">
        <button
          onClick={() => setView("applications")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
            view === "applications" ? "bg-background text-foreground shadow" : "text-muted-foreground"
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Applications
        </button>
        <button
          onClick={() => setView("templates")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
            view === "templates" ? "bg-background text-foreground shadow" : "text-muted-foreground"
          }`}
        >
          <Eye className="w-3.5 h-3.5" /> Templates
        </button>
      </div>

      {view === "templates" ? (
        <AdminApprovalTemplatePreview />
      ) : (
        <>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center"><Clock className="w-4 h-4 text-primary-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Pending</p><p className="text-lg font-bold text-foreground">{pendingCount}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-primary-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Approved</p><p className="text-lg font-bold text-foreground">{apps.filter(a => a.status === "approved").length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive flex items-center justify-center"><XCircle className="w-4 h-4 text-primary-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Rejected</p><p className="text-lg font-bold text-foreground">{apps.filter(a => a.status === "rejected").length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No applications found</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3">
            {filtered.map(app => (
              <Card key={app.id} className="border shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Store className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm text-foreground truncate">{app.business_name}</span>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{app.applicant_name} · {app.applicant_phone}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(app.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Category:</span> <span className="text-foreground">{getLabelForName(app.category)}</span></div>
                    {app.owner_name && <div><span className="text-muted-foreground">Owner:</span> <span className="text-foreground">{app.owner_name}</span></div>}
                    {app.contact_number && <div><span className="text-muted-foreground">Contact:</span> <span className="text-foreground">{app.contact_number}</span></div>}
                    {app.contact_email && <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{app.contact_email}</span></div>}
                    {app.trade_license && <div><span className="text-muted-foreground">License:</span> <span className="text-foreground">{app.trade_license}</span></div>}
                    {app.bank_name && <div><span className="text-muted-foreground">Bank:</span> <span className="text-foreground">{app.bank_name}</span></div>}
                    {app.bank_branch && <div><span className="text-muted-foreground">Branch:</span> <span className="text-foreground">{app.bank_branch}</span></div>}
                    {app.bank_account_holder && <div><span className="text-muted-foreground">A/C Holder:</span> <span className="text-foreground">{app.bank_account_holder}</span></div>}
                    {app.bank_account_number && <div><span className="text-muted-foreground">Account:</span> <span className="text-foreground">{app.bank_account_number}</span></div>}
                  </div>

                  {(app.business_address || app.reason) && (
                    <div className="space-y-1">
                      {app.business_address && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2"><span className="font-medium">Address:</span> {app.business_address}</p>
                      )}
                      {app.reason && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 italic">"{app.reason}"</p>
                      )}
                    </div>
                  )}

                  {app.status === "pending" && (
                    <div className="space-y-2 pt-1 border-t border-border">
                      <Textarea
                        placeholder="Admin notes (optional)..."
                        value={adminNotes[app.id] || ""}
                        onChange={e => setAdminNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                        rows={2}
                        className="text-xs"
                        maxLength={500}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAction(app, "approved")}
                          disabled={processing === app.id}
                        >
                          {processing === app.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                          Approve & Create Merchant
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(app, "rejected")}
                          disabled={processing === app.id}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {app.admin_notes && app.status !== "pending" && (
                    <div className="text-xs border-t border-border pt-2">
                      <span className="text-muted-foreground">Admin notes:</span> <span className="text-foreground">{app.admin_notes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
