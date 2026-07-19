import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ShieldAlert, Search, Unlock, History } from "lucide-react";

type Blocked = {
  phone: string;
  deleted_user_id: string | null;
  name: string | null;
  deleted_at: string;
  deletion_reason: string | null;
  last_unblock_attempt: string | null;
};

type AuditRow = {
  id: string;
  phone: string;
  admin_id: string;
  reason: string;
  created_at: string;
};

export default function AdminBlockedPhonesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Blocked | null>(null);
  const [reason, setReason] = useState("");

  const { data: blocked = [], isLoading } = useQuery({
    queryKey: ["admin-blocked-phones"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_blocked_phones");
      if (error) throw error;
      return (data ?? []) as Blocked[];
    },
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["phone-unblock-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_unblock_audit")
        .select("id, phone, admin_id, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const unblock = useMutation({
    mutationFn: async ({ phone, reason }: { phone: string; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_unblock_phone", {
        _phone: phone,
        _reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Phone unblocked", description: "The number can now be used to create a new account." });
      setTarget(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-blocked-phones"] });
      qc.invalidateQueries({ queryKey: ["phone-unblock-audit"] });
    },
    onError: (e: any) => {
      toast({ title: "Unblock failed", description: e.message ?? String(e), variant: "destructive" });
    },
  });

  const filtered = blocked.filter((b) =>
    q.trim() ? (b.phone ?? "").includes(q.trim()) || (b.name ?? "").toLowerCase().includes(q.trim().toLowerCase()) : true
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-destructive/10">
          <ShieldAlert className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Blocked Phone Numbers</h1>
          <p className="text-sm text-muted-foreground">
            Numbers permanently blocked because they belonged to a deleted EasyPay account.
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by phone or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No blocked numbers.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((b) => (
              <div key={`${b.phone}-${b.deleted_user_id}`} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{b.phone}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {b.name ?? "—"} · deleted {new Date(b.deleted_at).toLocaleDateString()}
                    {b.deletion_reason ? ` · ${b.deletion_reason}` : ""}
                  </div>
                  {b.last_unblock_attempt && (
                    <div className="text-[11px] text-amber-500">
                      Previous unblock: {new Date(b.last_unblock_attempt).toLocaleString()}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setTarget(b)}>
                  <Unlock className="h-3.5 w-3.5 mr-1.5" />
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Recent unblock audit log</h2>
        </div>
        {audit.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No entries yet.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {audit.map((a) => (
              <div key={a.id} className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <div className="min-w-0">
                  <div className="font-medium">{a.phone}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.reason}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unblock {target?.phone}</DialogTitle>
            <DialogDescription>
              This lets the number be reused to create a new EasyPay account. Provide a reason — it is stored in the
              audit log against your admin ID.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for unblocking (min 5 characters)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button
              disabled={reason.trim().length < 5 || unblock.isPending}
              onClick={() => target && unblock.mutate({ phone: target.phone, reason: reason.trim() })}
            >
              {unblock.isPending ? "Unblocking…" : "Confirm unblock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
