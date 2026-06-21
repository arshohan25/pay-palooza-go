import React, { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";


interface ParsedRow {
  name: string;
  price: number;
  original_price: number | null;
  category: string;
  stock: number;
  sku: string;
  brand: string;
  description: string;
  valid: boolean;
  error?: string;
}

interface Props {
  merchantId: string;
  businessName?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

const ensureVendorStore = async (merchantId: string, businessName: string) => {
  const { data } = await (supabase as any)
    .from("vendor_stores")
    .select("id")
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (!data) {
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    await (supabase as any).from("vendor_stores").insert({
      merchant_id: merchantId,
      store_name: businessName,
      slug,
      is_active: true,
    });
  }
};

const TEMPLATE_CSV = `name,price,original_price,category,stock,sku,brand,description
"Example Product",299,399,Electronics,50,SKU-001,BrandX,"A great product"
"Another Item",150,,Fashion,20,SKU-002,BrandY,"Stylish item"`;

const MerchantBulkUploadSheet = ({ merchantId, businessName, open, onOpenChange, onSuccess }: Props) => {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const fmtNum = (n: number) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US");
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);


  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "product-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuote) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') { inQuote = false; }
        else { cell += ch; }
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === ',') { row.push(cell.trim()); cell = ""; }
        else if (ch === '\n' || ch === '\r') {
          if (cell || row.length) { row.push(cell.trim()); result.push(row); row = []; cell = ""; }
          if (ch === '\r' && text[i + 1] === '\n') i++;
        } else { cell += ch; }
      }
    }
    if (cell || row.length) { row.push(cell.trim()); result.push(row); }
    return result;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImported(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = parseCSV(text);
      if (lines.length < 2) { toast({ title: t("mbuErrEmpty"), variant: "destructive" }); return; }
      
      const header = lines[0].map(h => h.toLowerCase().trim());
      const nameIdx = header.indexOf("name");
      const priceIdx = header.indexOf("price");
      const origIdx = header.indexOf("original_price");
      const catIdx = header.indexOf("category");
      const stockIdx = header.indexOf("stock");
      const skuIdx = header.indexOf("sku");
      const brandIdx = header.indexOf("brand");
      const descIdx = header.indexOf("description");

      if (nameIdx === -1 || priceIdx === -1) {
        toast({ title: t("mbuErrHeaders"), variant: "destructive" });
        return;
      }

      const parsed: ParsedRow[] = lines.slice(1).filter(r => r.some(c => c)).map(r => {
        const name = r[nameIdx] || "";
        const price = parseFloat(r[priceIdx] || "0");
        const original_price = origIdx >= 0 && r[origIdx] ? parseFloat(r[origIdx]) : null;
        const category = catIdx >= 0 ? (r[catIdx] || "General") : "General";
        const stock = stockIdx >= 0 ? parseInt(r[stockIdx] || "0", 10) : 0;
        const sku = skuIdx >= 0 ? (r[skuIdx] || "") : "";
        const brand = brandIdx >= 0 ? (r[brandIdx] || "") : "";
        const description = descIdx >= 0 ? (r[descIdx] || "") : "";

        const valid = !!name && price > 0;
        return { name, price, original_price, category, stock: isNaN(stock) ? 0 : stock, sku, brand, description, valid, error: !valid ? t("mbuRowInvalid") : undefined };
      });

      setRows(parsed);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    const validRows = rows.filter(r => r.valid);
    if (!validRows.length) { toast({ title: t("mbuErrNoValid"), variant: "destructive" }); return; }
    setImporting(true);
    if (businessName) {
      await ensureVendorStore(merchantId, businessName);
    }

    const payload = validRows.map(r => ({
      merchant_id: merchantId,
      name: r.name,
      price: r.price,
      original_price: r.original_price,
      category: r.category,
      stock: r.stock,
      sku: r.sku || null,
      brand: r.brand || null,
      description: r.description || null,
      emoji: "📦",
      is_active: true,
      images: [],
    }));

    const { error } = await (supabase as any).from("merchant_products").insert(payload);
    if (error) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${validRows.length} products imported ✓` });
      setImported(true);
      onSuccess();
    }
    setImporting(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setRows([]); setImported(false); } }}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><FileSpreadsheet size={18} /> Bulk Product Upload</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4 pb-8">
          {/* Template download */}
          <Button onClick={downloadTemplate} variant="outline" className="w-full rounded-xl gap-2 h-10">
            <Download size={14} /> Download CSV Template
          </Button>

          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-2xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">Click to upload CSV</p>
            <p className="text-xs text-muted-foreground mt-1">name, price, category, stock, sku, brand</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

          {/* Preview table */}
          {rows.length > 0 && !imported && (
            <>
              <Card className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-foreground">Preview ({rows.length} rows)</p>
                  <div className="flex gap-2 text-[10px]">
                    <span className="text-emerald-600 font-bold">{rows.filter(r => r.valid).length} valid</span>
                    {rows.some(r => !r.valid) && <span className="text-destructive font-bold">{rows.filter(r => !r.valid).length} invalid</span>}
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {rows.slice(0, 50).map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${r.valid ? "bg-muted/50" : "bg-destructive/10"}`}>
                      {r.valid ? <CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={12} className="text-destructive shrink-0" />}
                      <span className="font-medium text-foreground truncate flex-1">{r.name || "—"}</span>
                      <span className="text-muted-foreground">৳{r.price}</span>
                      <span className="text-muted-foreground">×{r.stock}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Button onClick={handleImport} disabled={importing || !rows.some(r => r.valid)} className="w-full rounded-xl h-11 gap-2 font-bold">
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Import {rows.filter(r => r.valid).length} Products
              </Button>
            </>
          )}

          {imported && (
            <div className="text-center py-6">
              <CheckCircle2 size={40} className="mx-auto text-emerald-600 mb-2" />
              <p className="text-sm font-bold text-foreground">Import Complete!</p>
              <p className="text-xs text-muted-foreground mt-1">Products are now in your catalog</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MerchantBulkUploadSheet;
