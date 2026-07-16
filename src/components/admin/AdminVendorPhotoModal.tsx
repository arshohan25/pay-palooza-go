import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw, Calendar, Upload, Camera, Ruler, FileImage } from "lucide-react";

interface Meta {
  mime?: string;
  bytes?: number;
  width?: number;
  height?: number;
  uploaded_at?: string;
  capture_date?: string | null;
  validated?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  path?: string | null;
  meta?: Meta | null;
  label: string;
}

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleString() : "—";
const fmtBytes = (b?: number) => !b ? "—" : b > 1024*1024 ? `${(b/1048576).toFixed(2)} MB` : `${Math.round(b/1024)} KB`;

export default function AdminVendorPhotoModal({ open, onOpenChange, path, meta, label }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);

  useEffect(() => {
    if (!open || !path) return;
    setZoom(1); setRot(0);
    (async () => {
      const { data } = await supabase.storage.from("vendor-kyc").createSignedUrl(path, 900);
      setUrl(data?.signedUrl ?? null);
    })();
  }, [open, path]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileImage className="w-4 h-4" /> {label}
          </DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-[1fr,240px] gap-3">
          <div className="relative bg-muted/30 rounded-lg overflow-hidden h-[520px] flex items-center justify-center">
            {url ? (
              <img
                src={url}
                alt={label}
                className="max-h-full max-w-full transition-transform"
                style={{ transform: `scale(${zoom}) rotate(${rot}deg)` }}
              />
            ) : (
              <p className="text-xs text-muted-foreground">No image uploaded</p>
            )}
            <div className="absolute bottom-2 right-2 flex gap-1 bg-background/80 backdrop-blur rounded-md p-1 border">
              <Button size="icon" variant="ghost" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} disabled={!url}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs px-2 self-center tabular-nums">{Math.round(zoom*100)}%</span>
              <Button size="icon" variant="ghost" onClick={() => setZoom(z => Math.min(4, z + 0.25))} disabled={!url}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setRot(r => (r + 90) % 360)} disabled={!url}>
                <RotateCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2 rounded-md border bg-muted/20">
              <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1"><Upload className="w-3 h-3" /> Uploaded</p>
              <p className="font-medium">{fmtDate(meta?.uploaded_at)}</p>
            </div>
            <div className="p-2 rounded-md border bg-muted/20">
              <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1"><Camera className="w-3 h-3" /> Captured (from file)</p>
              <p className="font-medium">{fmtDate(meta?.capture_date)}</p>
            </div>
            <div className="p-2 rounded-md border bg-muted/20">
              <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1"><Ruler className="w-3 h-3" /> Resolution</p>
              <p className="font-medium">{meta?.width && meta?.height ? `${meta.width} × ${meta.height}` : "—"}</p>
            </div>
            <div className="p-2 rounded-md border bg-muted/20">
              <p className="text-[10px] uppercase text-muted-foreground font-semibold">Format / Size</p>
              <p className="font-medium">{meta?.mime ?? "—"} · {fmtBytes(meta?.bytes)}</p>
            </div>
            <div className={`p-2 rounded-md border ${meta?.validated ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"}`}>
              <p className="font-semibold">{meta?.validated ? "Server-validated ✓" : "Not yet validated by server"}</p>
            </div>
            {url && <a href={url} target="_blank" rel="noreferrer" className="block text-primary text-center text-[11px] underline">Open original in new tab</a>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
