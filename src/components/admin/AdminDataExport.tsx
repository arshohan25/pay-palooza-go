import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Download, CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ENTITIES = [
  { value: "profiles", label: "Users", cols: ["user_id", "name", "phone", "balance", "status", "created_at"] },
  { value: "transactions", label: "Transactions", cols: ["id", "user_id", "type", "amount", "fee", "status", "created_at"] },
  { value: "agents", label: "Agents", cols: ["id", "user_id", "business_name", "status", "commission_earned", "created_at"] },
  { value: "merchants", label: "Merchants", cols: ["id", "user_id", "business_name", "category", "status", "created_at"] },
  { value: "distributors", label: "Distributors", cols: ["id", "user_id", "business_name", "commission_rate", "status", "created_at"] },
  { value: "audit_logs", label: "Audit Logs", cols: ["id", "actor_id", "action", "entity_type", "entity_id", "created_at"] },
];

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDataExport() {
  const [entity, setEntity] = useState("profiles");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const cfg = ENTITIES.find(e => e.value === entity)!;
      let query = supabase.from(entity as any).select(cfg.cols.join(",")).order("created_at", { ascending: false }).limit(5000);
      if (from) query = query.gte("created_at", from.toISOString());
      if (to) query = query.lte("created_at", new Date(to.getTime() + 86400000).toISOString());
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) { toast.info("No data to export"); setExporting(false); return; }
      const rows = (data as any[]).map(r => cfg.cols.map(c => r[c]?.toString() ?? ""));
      downloadCSV(`${cfg.label.toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.csv`, cfg.cols, rows);
      toast.success(`Exported ${data.length} ${cfg.label.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Download className="w-4 h-4" />Data Export Center</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Entity</p>
              <Select value={entity} onValueChange={setEntity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITIES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">From</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !from && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{from ? format(from, "PPP") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={from} onSelect={setFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">To</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !to && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{to ? format(to, "PPP") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={to} onSelect={setTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Button onClick={handleExport} disabled={exporting} className="w-full md:w-auto">
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
