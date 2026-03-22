import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Gift, Search, RefreshCw, Eye } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  redeemed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  expired: "bg-muted text-muted-foreground",
};

const STATUSES = ["all", "active", "redeemed", "expired"] as const;

export default function AdminGiftCardManagement() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detail, setDetail] = useState<any | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("gift_cards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    setCards(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = cards.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !c.code?.toLowerCase().includes(search.toLowerCase()) && !c.brand?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: cards.length,
    active: cards.filter(c => c.status === "active").length,
    redeemed: cards.filter(c => c.status === "redeemed").length,
    totalValue: cards.reduce((s, c) => s + Number(c.denomination), 0),
  };

  const revokeCard = async (id: string) => {
    const { error } = await supabase.from("gift_cards").update({ status: "expired" as any }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Gift card revoked");
    setDetail(null);
    fetch();
  };

  const maskCode = (code: string) => code ? code.slice(0, 4) + "****" + code.slice(-4) : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Cards", value: stats.total },
          { label: "Active", value: stats.active },
          { label: "Redeemed", value: stats.redeemed },
          { label: "Total Value", value: `৳${stats.totalValue.toLocaleString()}` },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by code or brand..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        {STATUSES.map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="capitalize h-8 text-xs">
            {s}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={fetch}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4" /> Gift Cards</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Code</TableHead>
                  <TableHead className="text-xs">Brand</TableHead>
                  <TableHead className="text-xs">Denomination</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Purchaser</TableHead>
                  <TableHead className="text-xs">Recipient</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No gift cards found</TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-mono">{maskCode(c.code)}</TableCell>
                    <TableCell className="text-xs font-semibold">{c.brand}</TableCell>
                    <TableCell className="text-xs">৳{Number(c.denomination).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[c.status] ?? ""}`}>{c.status}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{c.purchaser_id?.slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs">{c.recipient_phone || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setDetail(c)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        {c.status === "active" && (
                          <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => revokeCard(c.id)}>
                            Revoke
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Gift Card Details</SheetTitle>
            <SheetDescription>Full card information</SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="space-y-3 mt-4 text-sm">
              <div><span className="text-muted-foreground">Code:</span> <span className="font-mono font-bold">{detail.code}</span></div>
              <div><span className="text-muted-foreground">Brand:</span> {detail.brand}</div>
              <div><span className="text-muted-foreground">Denomination:</span> ৳{Number(detail.denomination).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant="secondary" className={STATUS_BADGE[detail.status] ?? ""}>{detail.status}</Badge></div>
              <div><span className="text-muted-foreground">Purchaser:</span> <span className="font-mono text-xs">{detail.purchaser_id}</span></div>
              <div><span className="text-muted-foreground">Recipient:</span> {detail.recipient_phone || "—"}</div>
              <div><span className="text-muted-foreground">Created:</span> {new Date(detail.created_at).toLocaleString()}</div>
              {detail.redeemed_at && <div><span className="text-muted-foreground">Redeemed:</span> {new Date(detail.redeemed_at).toLocaleString()}</div>}
              {detail.redeemed_by && <div><span className="text-muted-foreground">Redeemed By:</span> <span className="font-mono text-xs">{detail.redeemed_by}</span></div>}
              {detail.status === "active" && (
                <Button variant="destructive" size="sm" onClick={() => revokeCard(detail.id)} className="mt-2">Revoke Card</Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
