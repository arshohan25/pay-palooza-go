import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

/* ── Mock data ── */
const MONTHS = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];

const BAR_DATA = [
  { month: "Aug", Send: 12000, CashOut: 8000, Payment: 4500, Recharge: 1200 },
  { month: "Sep", Send: 9500,  CashOut: 6500, Payment: 5200, Recharge: 900  },
  { month: "Oct", Send: 14000, CashOut: 9000, Payment: 3800, Recharge: 1500 },
  { month: "Nov", Send: 11000, CashOut: 7500, Payment: 6000, Recharge: 800  },
  { month: "Dec", Send: 18500, CashOut: 12000, Payment: 7200, Recharge: 2000 },
  { month: "Jan", Send: 13500, CashOut: 8500, Payment: 5500, Recharge: 1100 },
];

const DONUT_DATA = [
  { name: "Send Money", value: 13500, color: "hsl(262 70% 55%)" },
  { name: "Cash Out",   value: 8500,  color: "hsl(340 75% 55%)" },
  { name: "Payment",    value: 5500,  color: "hsl(200 80% 50%)" },
  { name: "Recharge",   value: 1100,  color: "hsl(36 95% 55%)"  },
];

const TOP_MERCHANTS = [
  { name: "Pathao",       category: "Ride",     amount: 1850,  icon: "🚗" },
  { name: "Shajgoj",      category: "Shopping", amount: 1400,  icon: "🛍️" },
  { name: "Chaldal",      category: "Grocery",  amount: 1200,  icon: "🛒" },
  { name: "Robi",         category: "Telecom",  amount: 800,   icon: "📡" },
  { name: "FoodPanda",    category: "Food",     amount: 650,   icon: "🍔" },
];

const TOTAL_SENT     = 28600;
const TOTAL_RECEIVED = 34200;

/* ── Custom bar tooltip ── */
const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + p.value, 0);
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-elevated text-xs space-y-1 min-w-[130px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="font-medium text-foreground">৳{p.value.toLocaleString()}</span>
        </div>
      ))}
      <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold text-foreground">
        <span>Total</span>
        <span>৳{total.toLocaleString()}</span>
      </div>
    </div>
  );
};

/* ── Custom donut label ── */
const DonutLabel = ({ cx, cy, total }: { cx: number; cy: number; total: number }) => (
  <>
    <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
      style={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}>
      This month
    </text>
    <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
      style={{ fill: "hsl(var(--foreground))", fontSize: 16, fontWeight: 700 }}>
      ৳{total.toLocaleString()}
    </text>
  </>
);

interface InsightsPageProps {
  onBack: () => void;
}

const SpendingInsightsPage = ({ onBack }: InsightsPageProps) => {
  const [activeMonth, setActiveMonth] = useState("Jan");

  const donutTotal = DONUT_DATA.reduce((s, d) => s + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-6"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-card"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Spending Insights</h1>
          <p className="text-xs text-muted-foreground">Track your spending patterns</p>
        </div>
      </div>

      {/* Sent / Received summary */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card rounded-2xl border border-border p-4 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg gradient-cashout flex items-center justify-center">
              <ArrowUpRight size={14} className="text-primary-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Total Sent</span>
          </div>
          <p className="text-xl font-bold text-foreground">৳{TOTAL_SENT.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingDown size={11} className="text-destructive" />
            <span className="text-[11px] text-destructive font-medium">+12% vs last month</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-4 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <ArrowDownLeft size={14} className="text-primary-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Total Received</span>
          </div>
          <p className="text-xl font-bold text-foreground">৳{TOTAL_RECEIVED.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp size={11} className="text-primary" />
            <span className="text-[11px] text-primary font-medium">+8% vs last month</span>
          </div>
        </motion.div>
      </div>

      {/* Monthly bar chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">Monthly Breakdown</p>
          <div className="flex gap-1">
            {MONTHS.map((m) => (
              <button
                key={m}
                onClick={() => setActiveMonth(m)}
                className={`text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                  activeMonth === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="px-1 pb-4" style={{ height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={BAR_DATA} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.5)", radius: 4 }} />
              <Bar dataKey="Send"    stackId="a" fill="hsl(262 70% 55%)" radius={[0,0,0,0]} />
              <Bar dataKey="CashOut" stackId="a" fill="hsl(340 75% 55%)" />
              <Bar dataKey="Payment" stackId="a" fill="hsl(200 80% 50%)" />
              <Bar dataKey="Recharge" stackId="a" fill="hsl(36 95% 55%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-4 pb-4">
          {[
            { label: "Send",     color: "hsl(262 70% 55%)" },
            { label: "Cash Out", color: "hsl(340 75% 55%)" },
            { label: "Payment",  color: "hsl(200 80% 50%)" },
            { label: "Recharge", color: "hsl(36 95% 55%)"  },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Donut chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border shadow-card p-4"
      >
        <p className="text-sm font-bold text-foreground mb-3">Category Breakdown</p>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={DONUT_DATA}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={3}
                dataKey="value"
                labelLine={false}
              >
                {DONUT_DATA.map((entry, index) => (
                  <Cell key={index} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value, entry: any) => (
                  <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>
                    {value} <span style={{ color: "hsl(var(--muted-foreground))" }}>
                      (৳{entry.payload.value.toLocaleString()})
                    </span>
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Category bars */}
        <div className="space-y-2.5 mt-2">
          {DONUT_DATA.map((d) => {
            const pct = Math.round((d.value / donutTotal) * 100);
            return (
              <div key={d.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground font-medium">{d.name}</span>
                  <span className="text-muted-foreground">৳{d.value.toLocaleString()} · {pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: d.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Top merchants */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
      >
        <p className="text-sm font-bold text-foreground px-4 pt-4 pb-2">Top Merchants</p>
        {TOP_MERCHANTS.map((m, i) => {
          const max = TOP_MERCHANTS[0].amount;
          const pct = Math.round((m.amount / max) * 100);
          return (
            <div key={m.name} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
              <span className="text-xl w-8 text-center shrink-0">{m.icon}</span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{m.name}</span>
                  <span className="font-semibold text-foreground">৳{m.amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full gradient-primary transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">
                    #{i + 1} · {m.category}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
};

export default SpendingInsightsPage;
