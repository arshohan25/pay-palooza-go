import { useState, useEffect } from "react";
import { RotateCcw, Search, CheckCircle2, XCircle, Clock, Eye, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details });
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle2 },
};

export default function AdminReturnRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("return_requests")
      .select("*, orders(order_num, total, user_id)")
      .order("created_at", { ascending: false });
    if (data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdating(true);
    const { error } = await (supabase as any)
      .from("return_requests")
      .update({
        status,
        admin_notes: adminNotes || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      await auditLog(`return_request_${status}`, "return_request", id, { status, admin_notes: adminNotes || null });
      toast.success(`Return request ${status}`);
      setSelectedRequest(null);
      setAdminNotes("");
      load();
    }
    setUpdating(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("return_requests").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await auditLog("return_request_delete", "return_request", id, {});
    toast.success("Return request deleted");
    load();
  };

  const filtered = requests.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.reason?.toLowerCase().includes(q) ||
        r.orders?.order_num?.toLowerCase().includes(q) ||
        r.id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-primary" /> Return Requests
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by order #..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No return requests found</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((req) => {
              const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
                  <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{req.orders?.order_num || "Order"}</p>
                    <p className="text-xs text-muted-foreground truncate">{req.reason}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <Badge className={cfg.color}>{cfg.label}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedRequest(req); setAdminNotes(req.admin_notes || ""); }}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  {(req.status === "completed" || req.status === "rejected") && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Return Request</AlertDialogTitle>
                          <AlertDialogDescription>Delete this return request? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(req.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return Request Details</DialogTitle>
              <DialogDescription>Order: {selectedRequest?.orders?.order_num}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Reason</p>
                <p className="text-sm text-foreground">{selectedRequest?.reason}</p>
              </div>
              {selectedRequest?.details && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Additional Details</p>
                  <p className="text-sm text-foreground">{selectedRequest?.details}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Admin Notes</p>
                <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Add notes..." rows={3} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              {selectedRequest?.status === "pending" && (
                <>
                  <Button variant="destructive" disabled={updating} onClick={() => handleStatusUpdate(selectedRequest.id, "rejected")}>
                    Reject
                  </Button>
                  <Button disabled={updating} onClick={() => handleStatusUpdate(selectedRequest.id, "approved")}>
                    Approve
                  </Button>
                </>
              )}
              {selectedRequest?.status === "approved" && (
                <Button disabled={updating} onClick={() => handleStatusUpdate(selectedRequest.id, "completed")}>
                  Mark Completed
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
