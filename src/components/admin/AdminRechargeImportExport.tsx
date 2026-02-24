import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CSV_HEADERS = [
  "operator", "name", "details", "validity", "price", "type",
  "sub_category", "badge", "tag", "highlight", "cashback", "sort_order", "is_active",
];

function packToCsvRow(p: any): string {
  return CSV_HEADERS.map(h => {
    const val = p[h] ?? "";
    const str = String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  }).join(",");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

export default function AdminRechargeImportExport() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCsv = async () => {
    setExporting(true);
    const { data, error } = await supabase
      .from("recharge_packs")
      .select("*")
      .order("operator")
      .order("sort_order");

    if (error || !data) {
      toast.error("Failed to fetch packs");
      setExporting(false);
      return;
    }

    const csv = [CSV_HEADERS.join(","), ...data.map(packToCsvRow)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recharge-packs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} packs`);
    setExporting(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      toast.error("CSV must have a header row and at least one data row");
      setImporting(false);
      return;
    }

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const errors: string[] = [];
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length < headers.length) {
        errors.push(`Row ${i + 1}: Not enough columns`);
        continue;
      }

      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx]; });

      // Validate required fields
      if (!row.operator || !row.name || !row.details || !row.validity || !row.price) {
        errors.push(`Row ${i + 1}: Missing required fields (operator, name, details, validity, price)`);
        continue;
      }

      const price = Number(row.price);
      if (isNaN(price) || price <= 0) {
        errors.push(`Row ${i + 1}: Invalid price "${row.price}"`);
        continue;
      }

      rows.push({
        operator: row.operator,
        name: row.name,
        details: row.details,
        validity: row.validity,
        price,
        type: row.type || "regular",
        sub_category: row.sub_category || null,
        badge: row.badge || null,
        tag: row.tag || null,
        highlight: row.highlight === "true",
        cashback: Number(row.cashback) || 0,
        sort_order: Number(row.sort_order) || 0,
        is_active: row.is_active !== "false",
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("recharge_packs").insert(rows as any);
      if (error) {
        errors.push(`Database error: ${error.message}`);
      }
    }

    setImportResult({ added: rows.length - (errors.length > 0 ? 0 : 0), errors });
    if (errors.length === 0 && rows.length > 0) {
      toast.success(`Imported ${rows.length} packs`);
    } else if (rows.length > 0) {
      toast.success(`Imported ${rows.length} packs with ${errors.length} warnings`);
    } else {
      toast.error("No valid packs found in CSV");
    }

    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">Bulk Import / Export</h3>
        <p className="text-sm text-muted-foreground">
          Download all packs as CSV or upload new packs in bulk
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Download className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Export Packs</p>
              <p className="text-xs text-muted-foreground mt-1">
                Download all recharge packs as a CSV file
              </p>
            </div>
            <Button onClick={exportCsv} disabled={exporting} className="gap-1.5 w-full">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {exporting ? "Exporting…" : "Download CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* Import */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/50 flex items-center justify-center">
              <Upload className="w-7 h-7 text-accent-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Import Packs</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a CSV to add new packs in bulk
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="gap-1.5 w-full"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Importing…" : "Upload CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* CSV format guide */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-foreground mb-2">CSV Format</p>
          <p className="text-xs text-muted-foreground mb-2">
            Required columns: <Badge variant="outline" className="text-[10px]">operator</Badge>{" "}
            <Badge variant="outline" className="text-[10px]">name</Badge>{" "}
            <Badge variant="outline" className="text-[10px]">details</Badge>{" "}
            <Badge variant="outline" className="text-[10px]">validity</Badge>{" "}
            <Badge variant="outline" className="text-[10px]">price</Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            Optional: type, sub_category, badge, tag, highlight, cashback, sort_order, is_active
          </p>
          <div className="mt-3 bg-muted/50 rounded-lg p-3 overflow-x-auto">
            <code className="text-[11px] text-foreground whitespace-pre">
              {CSV_HEADERS.join(",")}{"\n"}
              Grameenphone,3GB Weekly,3GB Internet 7 Days,7 days,99,regular,internet,Popular,,false,0,1,true
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Import result */}
      {importResult && (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                {importResult.added} packs imported
              </p>
            </div>
            {importResult.errors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <p className="text-xs font-medium">{importResult.errors.length} issues:</p>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{err}</p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
