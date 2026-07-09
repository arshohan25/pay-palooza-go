import { useState } from "react";
import { motion } from "framer-motion";

import { Plus, Trash2, Pencil, Target } from "lucide-react";
import { useSpendingBudgets, BUDGET_CATEGORIES } from "@/hooks/use-spending-budgets";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

const BudgetManager = () => {
  const { budgets, spending, loading, setBudget, toggleRecurring, removeBudget, categoryLabel } = useSpendingBudgets();

  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newLimit, setNewLimit] = useState("");

  const usedCategories = new Set(budgets.map((b) => b.category));
  const available = BUDGET_CATEGORIES.filter((c) => !usedCategories.has(c.key));

  const handleAdd = async () => {
    if (!newCat || !newLimit || Number(newLimit) <= 0) return;
    await setBudget(newCat, Number(newLimit));
    setAdding(false);
    setNewCat("");
    setNewLimit("");
  };

  const handleEdit = async (id: string, category: string) => {
    if (!editValue || Number(editValue) <= 0) return;
    const b = budgets.find((x) => x.id === id);
    await setBudget(category, Number(editValue), b?.is_recurring ?? true);
    setEditId(null);
    setEditValue("");
  };

  if (loading) {
    return (
      <div className="bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-3">
        <div className="h-5 w-32 rounded-lg bg-muted animate-pulse" />
        <div className="h-12 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14 }}
      className="bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Target size={15} className="text-primary" />
          </div>
          <p className="text-sm font-bold text-foreground">Monthly Budgets</p>
        </div>
        {available.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => { setAdding(!adding); setNewCat(available[0]?.key || ""); }}
            className="text-xs font-semibold text-primary flex items-center gap-1"
          >
            <Plus size={14} /> Add
          </motion.button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="space-y-2 overflow-hidden">
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
          >
            {available.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="৳ Limit"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              className="rounded-xl text-sm"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAdd}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shrink-0"
            >
              Save
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Budget list */}
      {budgets.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-3">
          No budgets set. Tap Add to create one.
        </p>
      )}

      {budgets.map((b) => {
        const spent = spending[b.category] || 0;
        const pct = b.monthly_limit > 0 ? Math.min(Math.round((spent / b.monthly_limit) * 100), 100) : 0;
        const barColor =
          pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary";

        return (
          <div key={b.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{categoryLabel(b.category)}</span>
              <div className="flex items-center gap-2">
                {editId === b.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 h-7 rounded-lg text-xs"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleEdit(b.id, b.category)}
                    />
                    <button onClick={() => handleEdit(b.id, b.category)} className="text-primary text-xs font-semibold">✓</button>
                    <button onClick={() => setEditId(null)} className="text-muted-foreground text-xs">✕</button>
                  </div>
                ) : (
                  <>
                    <span className="text-[11px] text-muted-foreground">
                      ৳{spent.toLocaleString()} / ৳{b.monthly_limit.toLocaleString()}
                    </span>
                    <button onClick={() => { setEditId(b.id); setEditValue(String(b.monthly_limit)); }}>
                      <Pencil size={12} className="text-muted-foreground hover:text-foreground" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={b.is_recurring}
                  onCheckedChange={(v) => toggleRecurring(b.id, v)}
                  className="scale-75 origin-left"
                />
                <span className="text-[10px] text-muted-foreground">
                  {b.is_recurring ? "Recurring" : "One-time"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold ${pct >= 90 ? "text-destructive" : pct >= 70 ? "text-amber-500" : "text-primary"}`}>
                  {pct}%
                </span>
                <button onClick={() => removeBudget(b.id)}>
                  <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
};

export default BudgetManager;
