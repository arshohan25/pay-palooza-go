import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Save,
  RotateCcw,
  Sliders,
  Bell,
  ShieldAlert,
  History,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/use-admin";

interface Threshold {
  key: string;
  value: number;
  label: string;
  description: string | null;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  threshold_key: string;
  action: "insert" | "update" | "delete";
  actor_id: string | null;
  actor_name: string | null;
  before_value: { value?: number | null } | null;
  after_value: { value?: number | null } | null;
  changed_at: string;
}

const DEFAULTS: Record<string, number> = {
  merchant_low_stock_units: 5,
  agent_float_low_pct: 10,
};

export default function AdminPlatformThresholds() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [rows, setRows] = useState<Threshold[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("platform_thresholds")
      .select("*")
      .order("key");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Threshold[]);
    setLoading(false);
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    const { data, error } = await (supabase as any)
      .from("platform_thresholds_audit")
      .select("id, threshold_key, action, actor_id, before_value, after_value, changed_at")
      .order("changed_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error(error.message);
      setAuditLoading(false);
      return;
    }
    const entries = (data ?? []) as AuditEntry[];
    // Resolve actor names from profiles in one round-trip.
    const actorIds = Array.from(
      new Set(entries.map((e) => e.actor_id).filter((v): v is string => !!v))
    );
    let nameMap = new Map<string, string>();
    if (actorIds.length) {
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("id, name, phone")
        .in("id", actorIds);
      for (const p of (profs ?? []) as Array<{ id: string; name: string | null; phone: string | null }>) {
        nameMap.set(p.id, p.name || p.phone || p.id.slice(0, 8));
      }
    }
    setAudit(
      entries.map((e) => ({
        ...e,
        actor_name: e.actor_id ? nameMap.get(e.actor_id) ?? e.actor_id.slice(0, 8) : "system",
      }))
    );
    setAuditLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      load();
      loadAudit();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const save = async (row: Threshold) => {
    const raw = edits[row.key];
    if (raw == null || raw === "") return;
    const next = Number(raw);
    if (!Number.isFinite(next)) {
      toast.error("Enter a valid number");
      return;
    }
    if (row.min_value != null && next < row.min_value) {
      toast.error(`Must be ≥ ${row.min_value}`);
      return;
    }
    if (row.max_value != null && next > row.max_value) {
      toast.error(`Must be ≤ ${row.max_value}`);
      return;
    }
    setSaving(row.key);
    const { error } = await (supabase as any)
      .from("platform_thresholds")
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq("key", row.key);
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${row.label} updated`);
    setEdits((e) => {
      const n = { ...e };
      delete n[row.key];
      return n;
    });
    load();
    loadAudit();

  const reset = async (row: Threshold) => {
    const def = DEFAULTS[row.key];
    if (def == null) return;
    setSaving(row.key);
    const { error } = await (supabase as any)
      .from("platform_thresholds")
      .update({ value: def, updated_at: new Date().toISOString() })
      .eq("key", row.key);
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Reset to default (${def}${row.unit ?? ""})`);
    load();
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-10 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm font-semibold text-foreground">Admin access required</p>
          <p className="text-xs text-muted-foreground">
            Only administrators can view or modify platform thresholds.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Sliders size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Alert Thresholds</h2>
            <p className="text-sm text-muted-foreground">
              Tune system-wide alert sensitivity without code changes.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No thresholds configured.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row, i) => {
            const dirty = edits[row.key] != null && edits[row.key] !== String(row.value);
            const isDefault = DEFAULTS[row.key] != null && row.value === DEFAULTS[row.key];
            return (
              <motion.div
                key={row.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Bell size={14} className="text-primary mt-1 shrink-0" />
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-bold leading-tight">
                            {row.label}
                          </CardTitle>
                          {row.description && (
                            <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">
                              {row.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {isDefault && (
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                          default
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={edits[row.key] ?? String(row.value)}
                        onChange={(e) =>
                          setEdits((s) => ({ ...s, [row.key]: e.target.value }))
                        }
                        min={row.min_value ?? undefined}
                        max={row.max_value ?? undefined}
                        className="h-9 text-sm font-semibold"
                      />
                      {row.unit && (
                        <span className="text-xs font-semibold text-muted-foreground shrink-0">
                          {row.unit}
                        </span>
                      )}
                    </div>
                    {(row.min_value != null || row.max_value != null) && (
                      <p className="text-[10.5px] text-muted-foreground">
                        Range: {row.min_value ?? "—"} – {row.max_value ?? "—"}
                        {row.unit ? ` ${row.unit}` : ""}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => save(row)}
                        disabled={!dirty || saving === row.key}
                        className="rounded-lg h-8 text-xs gap-1.5 flex-1"
                      >
                        {saving === row.key ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Save size={12} />
                        )}
                        Save
                      </Button>
                      {DEFAULTS[row.key] != null && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reset(row)}
                          disabled={saving === row.key || isDefault}
                          className="rounded-lg h-8 text-xs gap-1.5"
                        >
                          <RotateCcw size={12} />
                          Default
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Last updated {new Date(row.updated_at).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
