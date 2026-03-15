import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Route, Plus, Copy, ExternalLink, Link2, CheckCircle, Clock, XCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type SubTab = "routing" | "payment_links";

interface PaymentLink {
  id: string;
  title: string;
  amount: number | null;
  currency: string;
  description: string | null;
  short_code: string;
  is_active: boolean;
  max_uses: number | null;
  used_count: number;
  created_by: string;
  expires_at: string | null;
  created_at: string;
}

export default function AdminSmartRouting() {
  const [subTab, setSubTab] = useState<SubTab>("routing");
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment links - stored client side since no dedicated table yet
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: "", amount: "", description: "", maxUses: "", expiresAt: "" });

  const loadGateways = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("payment_gateways").select("*").order("sort_order", { ascending: true });
    setGateways(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadGateways(); }, [loadGateways]);

  const updatePriority = async (id: string, newOrder: number) => {
    const { error } = await supabase.from("payment_gateways").update({ sort_order: newOrder }).eq("id", id);
    if (error) { toast.error("Failed to update priority"); return; }
    toast.success("Priority updated");
    loadGateways();
  };

  const toggleGateway = async (id: string, current: boolean) => {
    const { error } = await supabase.from("payment_gateways").update({ is_enabled: !current }).eq("id", id);
    if (error) { toast.error("Failed to toggle"); return; }
    toast.success(`Gateway ${!current ? "enabled" : "disabled"}`);
    loadGateways();
  };

  const generateShortCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "PAY-";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const createPaymentLink = () => {
    if (!linkForm.title) { toast.error("Title required"); return; }
    const link: PaymentLink = {
      id: crypto.randomUUID(),
      title: linkForm.title,
      amount: linkForm.amount ? Number(linkForm.amount) : null,
      currency: "BDT",
      description: linkForm.description || null,
      short_code: generateShortCode(),
      is_active: true,
      max_uses: linkForm.maxUses ? Number(linkForm.maxUses) : null,
      used_count: 0,
      created_by: "admin",
      expires_at: linkForm.expiresAt || null,
      created_at: new Date().toISOString(),
    };
    setPaymentLinks(prev => [link, ...prev]);
    setShowLinkForm(false);
    setLinkForm({ title: "", amount: "", description: "", maxUses: "", expiresAt: "" });
    toast.success("Payment link created");
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${code}`);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Route className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Smart Routing & Payment Links</h2>
      </div>

      <div className="flex gap-2">
        <Button variant={subTab === "routing" ? "default" : "outline"} size="sm" onClick={() => setSubTab("routing")}>Gateway Routing</Button>
        <Button variant={subTab === "payment_links" ? "default" : "outline"} size="sm" onClick={() => setSubTab("payment_links")}>Payment Links</Button>
      </div>

      {subTab === "routing" && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Routing Priority</CardTitle>
              <p className="text-xs text-muted-foreground">Transactions route to the highest-priority enabled gateway. Lower number = higher priority.</p>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Priority</TableHead>
                        <TableHead>Gateway</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gateways.map((gw, idx) => (
                        <TableRow key={gw.id}>
                          <TableCell>
                            <Input
                              type="number" min={0}
                              value={gw.sort_order}
                              onChange={(e) => updatePriority(gw.id, Number(e.target.value))}
                              className="w-16 h-7 text-xs text-center"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{gw.display_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{gw.provider}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={gw.is_enabled ? "secondary" : "outline"} className={`text-[10px] ${gw.is_enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : ""}`}>
                              {gw.is_enabled ? "Active" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch checked={gw.is_enabled} onCheckedChange={() => toggleGateway(gw.id, gw.is_enabled)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Routing Rules</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Failover Enabled</span>
                  <Switch defaultChecked />
                </div>
                <p className="text-xs text-muted-foreground">Automatically route to next gateway if primary fails</p>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Amount-based Routing</span>
                  <Switch />
                </div>
                <p className="text-xs text-muted-foreground">Route large transactions (৳50K+) to specific gateway</p>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Load Balancing</span>
                  <Switch />
                </div>
                <p className="text-xs text-muted-foreground">Distribute load across multiple gateways</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {subTab === "payment_links" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowLinkForm(true)}><Plus className="w-3.5 h-3.5 mr-1.5" /> Create Link</Button>
          </div>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="hidden md:table-cell">Code</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentLinks.map(link => (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium text-foreground text-sm">{link.title}</TableCell>
                        <TableCell className="text-sm">{link.amount ? `৳${link.amount.toLocaleString()}` : "Custom"}</TableCell>
                        <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-[9px] font-mono">{link.short_code}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{link.used_count}{link.max_uses ? `/${link.max_uses}` : ""}</TableCell>
                        <TableCell><Badge variant={link.is_active ? "secondary" : "outline"} className="text-[10px]">{link.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyLink(link.short_code)}><Copy className="w-3 h-3" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paymentLinks.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payment links yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showLinkForm} onOpenChange={setShowLinkForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Payment Link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Title</Label><Input value={linkForm.title} onChange={e => setLinkForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Monthly Subscription" /></div>
            <div><Label className="text-xs">Amount (leave empty for custom)</Label><Input type="number" value={linkForm.amount} onChange={e => setLinkForm(p => ({ ...p, amount: e.target.value }))} placeholder="৳0.00" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={linkForm.description} onChange={e => setLinkForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Max Uses</Label><Input type="number" value={linkForm.maxUses} onChange={e => setLinkForm(p => ({ ...p, maxUses: e.target.value }))} placeholder="Unlimited" /></div>
              <div><Label className="text-xs">Expires At</Label><Input type="date" value={linkForm.expiresAt} onChange={e => setLinkForm(p => ({ ...p, expiresAt: e.target.value }))} /></div>
            </div>
            <Button className="w-full" onClick={createPaymentLink}>Create Link</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
