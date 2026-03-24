import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  CalendarIcon, RefreshCw, Eye, Users, ArrowLeftRight, Landmark, Gift, Shield, FileText,
  UserCog, UserPlus, UserMinus, ToggleLeft, Store, ShoppingCart, CreditCard, Bell,
  Lock, Unlock, Ban, Pencil, Package, Settings, Truck, AlertTriangle, CheckCircle,
  XCircle, Send, Zap, Database, Key, Layers, Tag, RotateCcw, Search, Trash2, Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
}

interface AdminProfile {
  user_id: string;
  name: string | null;
  phone: string;
}

const PAGE_SIZE = 50;

const CATEGORY_MAP: Record<string, { label: string; actions: string[] }> = {
  profile_views: { label: "Profile Views", actions: ["view_user_profile", "view_all_profiles"] },
  chargebacks: { label: "Chargebacks", actions: ["chargeback", "chargeback_reversal"] },
  treasury: { label: "Treasury", actions: ["treasury_disburse"] },
  referrals: { label: "Referrals", actions: ["referral_milestone_pay", "referral_milestone_reset", "referral_reset_all"] },
  user_management: { label: "User Management", actions: ["toggle_user_status", "soft_delete_user", "reactivate_user", "device_revoked"] },
  agents: { label: "Agents", actions: ["create_agent", "edit_agent", "delete_agent", "toggle_agent_status"] },
  distributors: { label: "Distributors", actions: ["create_distributor", "edit_distributor", "delete_distributor", "toggle_distributor_status"] },
  merchants: { label: "Merchants", actions: ["edit_merchant", "delete_merchant", "toggle_merchant_status", "regenerate_api_key", "approve_application", "reject_application"] },
  kyc: { label: "KYC", actions: ["approve_kyc", "reject_kyc", "request_resubmit"] },
  team: { label: "Team", actions: ["create_team_member", "edit_team_member", "delete_team_member", "toggle_team_status"] },
  security_risk: { label: "Security & Risk", actions: ["blacklist_added", "blacklist_toggled", "blacklist_deleted", "blacklist_edited", "gateway_toggled", "gateway_created", "gateway_updated", "gateway_deleted", "fraud_rule_create", "fraud_rule_edit", "fraud_rule_delete", "fraud_rule_toggle", "freeze_wallet", "unfreeze_wallet", "aml_toggle"] },
  financial: { label: "Financial", actions: ["commission_rule_edit", "commission_rule_delete", "commission_tier_create", "commission_tier_edit", "commission_tier_delete", "settlement_create", "settlement_status", "settlement_delete", "adjust_balance"] },
  system_config: { label: "System Config", actions: ["create_feature_lock", "delete_feature_lock", "create_toggle", "edit_toggle", "delete_toggle", "toggle_feature", "update_app_config", "update_fee_rule", "update_txn_rule", "toggle_maintenance", "banner_create", "banner_update", "banner_delete", "create_bank", "toggle_bank", "delete_bank"] },
  ecommerce: { label: "E-Commerce", actions: ["flash_sale_create", "flash_sale_edit", "flash_sale_delete", "flash_sale_toggle", "order_status", "order_cancel", "order_bulk_status", "return_status", "return_delete", "product_toggle", "product_edit", "product_delete", "store_toggle", "coupon_create", "coupon_edit", "coupon_delete", "bulk_import_packs", "update_stock"] },
  fraud: { label: "Fraud Alerts", actions: ["fraud_alert_status", "fraud_alert_assign", "fraud_alert_escalate", "fraud_alert_delete", "fraud_investigate"] },
  notifications: { label: "Notifications & Charges", actions: ["notification_send", "charge_config_create", "charge_config_edit", "charge_config_delete", "charge_config_toggle", "approve_api_request", "reject_api_request"] },
};

const ALL_KNOWN_ACTIONS = Object.values(CATEGORY_MAP).flatMap(c => c.actions);

const I = { s: 3, c: "w-3 h-3" }; // icon size shorthand

const ACTION_META: Record<string, { label: string; icon: React.ReactNode }> = {
  // Profile Views
  view_user_profile: { label: "View Profile", icon: <Eye className={I.c} /> },
  view_all_profiles: { label: "View User List", icon: <Users className={I.c} /> },
  // Chargebacks
  chargeback: { label: "Chargeback", icon: <ArrowLeftRight className={I.c} /> },
  chargeback_reversal: { label: "Chargeback Reversal", icon: <ArrowLeftRight className={I.c} /> },
  // Treasury
  treasury_disburse: { label: "Treasury Disburse", icon: <Landmark className={I.c} /> },
  // Referrals
  referral_milestone_pay: { label: "Referral Pay", icon: <Gift className={I.c} /> },
  referral_milestone_reset: { label: "Referral Reset", icon: <Gift className={I.c} /> },
  referral_reset_all: { label: "Referral Reset All", icon: <Gift className={I.c} /> },
  // User Management
  toggle_user_status: { label: "Toggle User Status", icon: <ToggleLeft className={I.c} /> },
  soft_delete_user: { label: "Soft Delete User", icon: <UserMinus className={I.c} /> },
  reactivate_user: { label: "Reactivate User", icon: <UserPlus className={I.c} /> },
  device_revoked: { label: "Device Revoked", icon: <Lock className={I.c} /> },
  // Agents
  create_agent: { label: "Create Agent", icon: <UserPlus className={I.c} /> },
  edit_agent: { label: "Edit Agent", icon: <Pencil className={I.c} /> },
  delete_agent: { label: "Delete Agent", icon: <Trash2 className={I.c} /> },
  toggle_agent_status: { label: "Toggle Agent Status", icon: <ToggleLeft className={I.c} /> },
  // Distributors
  create_distributor: { label: "Create Distributor", icon: <UserPlus className={I.c} /> },
  edit_distributor: { label: "Edit Distributor", icon: <Pencil className={I.c} /> },
  delete_distributor: { label: "Delete Distributor", icon: <Trash2 className={I.c} /> },
  toggle_distributor_status: { label: "Toggle Distributor", icon: <ToggleLeft className={I.c} /> },
  // Merchants
  edit_merchant: { label: "Edit Merchant", icon: <Pencil className={I.c} /> },
  delete_merchant: { label: "Delete Merchant", icon: <Trash2 className={I.c} /> },
  toggle_merchant_status: { label: "Toggle Merchant", icon: <ToggleLeft className={I.c} /> },
  regenerate_api_key: { label: "Regenerate API Key", icon: <Key className={I.c} /> },
  approve_application: { label: "Approve Application", icon: <CheckCircle className={I.c} /> },
  reject_application: { label: "Reject Application", icon: <XCircle className={I.c} /> },
  // KYC
  approve_kyc: { label: "Approve KYC", icon: <CheckCircle className={I.c} /> },
  reject_kyc: { label: "Reject KYC", icon: <XCircle className={I.c} /> },
  request_resubmit: { label: "Request Resubmit", icon: <RotateCcw className={I.c} /> },
  // Team
  create_team_member: { label: "Create Team Member", icon: <UserPlus className={I.c} /> },
  edit_team_member: { label: "Edit Team Member", icon: <Pencil className={I.c} /> },
  delete_team_member: { label: "Delete Team Member", icon: <Trash2 className={I.c} /> },
  toggle_team_status: { label: "Toggle Team Status", icon: <ToggleLeft className={I.c} /> },
  // Security & Risk
  blacklist_added: { label: "Blacklist Added", icon: <Ban className={I.c} /> },
  blacklist_toggled: { label: "Blacklist Toggled", icon: <ToggleLeft className={I.c} /> },
  blacklist_deleted: { label: "Blacklist Deleted", icon: <Trash2 className={I.c} /> },
  blacklist_edited: { label: "Blacklist Edited", icon: <Pencil className={I.c} /> },
  gateway_toggled: { label: "Gateway Toggled", icon: <ToggleLeft className={I.c} /> },
  gateway_created: { label: "Gateway Created", icon: <Plus className={I.c} /> },
  gateway_updated: { label: "Gateway Updated", icon: <Pencil className={I.c} /> },
  gateway_deleted: { label: "Gateway Deleted", icon: <Trash2 className={I.c} /> },
  fraud_rule_create: { label: "Fraud Rule Created", icon: <AlertTriangle className={I.c} /> },
  fraud_rule_edit: { label: "Fraud Rule Edited", icon: <AlertTriangle className={I.c} /> },
  fraud_rule_delete: { label: "Fraud Rule Deleted", icon: <AlertTriangle className={I.c} /> },
  fraud_rule_toggle: { label: "Fraud Rule Toggled", icon: <ToggleLeft className={I.c} /> },
  freeze_wallet: { label: "Freeze Wallet", icon: <Lock className={I.c} /> },
  unfreeze_wallet: { label: "Unfreeze Wallet", icon: <Unlock className={I.c} /> },
  aml_toggle: { label: "AML Rule Toggled", icon: <Shield className={I.c} /> },
  // Financial
  commission_rule_edit: { label: "Commission Rule Edit", icon: <CreditCard className={I.c} /> },
  commission_rule_delete: { label: "Commission Rule Delete", icon: <CreditCard className={I.c} /> },
  commission_tier_create: { label: "Commission Tier Create", icon: <Layers className={I.c} /> },
  commission_tier_edit: { label: "Commission Tier Edit", icon: <Layers className={I.c} /> },
  commission_tier_delete: { label: "Commission Tier Delete", icon: <Layers className={I.c} /> },
  settlement_create: { label: "Settlement Created", icon: <CreditCard className={I.c} /> },
  settlement_status: { label: "Settlement Status", icon: <CreditCard className={I.c} /> },
  settlement_delete: { label: "Settlement Deleted", icon: <Trash2 className={I.c} /> },
  adjust_balance: { label: "Balance Adjusted", icon: <Database className={I.c} /> },
  // System Config
  create_feature_lock: { label: "Feature Locked", icon: <Lock className={I.c} /> },
  delete_feature_lock: { label: "Feature Unlocked", icon: <Unlock className={I.c} /> },
  create_toggle: { label: "Toggle Created", icon: <Plus className={I.c} /> },
  edit_toggle: { label: "Toggle Edited", icon: <Pencil className={I.c} /> },
  delete_toggle: { label: "Toggle Deleted", icon: <Trash2 className={I.c} /> },
  toggle_feature: { label: "Feature Toggled", icon: <ToggleLeft className={I.c} /> },
  update_app_config: { label: "App Config Updated", icon: <Settings className={I.c} /> },
  update_fee_rule: { label: "Fee Rule Updated", icon: <Settings className={I.c} /> },
  update_txn_rule: { label: "Txn Rule Updated", icon: <Settings className={I.c} /> },
  toggle_maintenance: { label: "Maintenance Toggled", icon: <Settings className={I.c} /> },
  banner_create: { label: "Banner Created", icon: <Plus className={I.c} /> },
  banner_update: { label: "Banner Updated", icon: <Pencil className={I.c} /> },
  banner_delete: { label: "Banner Deleted", icon: <Trash2 className={I.c} /> },
  create_bank: { label: "Bank Created", icon: <Landmark className={I.c} /> },
  toggle_bank: { label: "Bank Toggled", icon: <ToggleLeft className={I.c} /> },
  delete_bank: { label: "Bank Deleted", icon: <Trash2 className={I.c} /> },
  // E-Commerce
  flash_sale_create: { label: "Flash Sale Created", icon: <Zap className={I.c} /> },
  flash_sale_edit: { label: "Flash Sale Edited", icon: <Zap className={I.c} /> },
  flash_sale_delete: { label: "Flash Sale Deleted", icon: <Zap className={I.c} /> },
  flash_sale_toggle: { label: "Flash Sale Toggled", icon: <Zap className={I.c} /> },
  order_status: { label: "Order Status Changed", icon: <Package className={I.c} /> },
  order_cancel: { label: "Order Cancelled", icon: <XCircle className={I.c} /> },
  order_bulk_status: { label: "Bulk Order Update", icon: <Package className={I.c} /> },
  return_status: { label: "Return Status Changed", icon: <RotateCcw className={I.c} /> },
  return_delete: { label: "Return Deleted", icon: <Trash2 className={I.c} /> },
  product_toggle: { label: "Product Toggled", icon: <ShoppingCart className={I.c} /> },
  product_edit: { label: "Product Edited", icon: <Pencil className={I.c} /> },
  product_delete: { label: "Product Deleted", icon: <Trash2 className={I.c} /> },
  store_toggle: { label: "Store Toggled", icon: <Store className={I.c} /> },
  coupon_create: { label: "Coupon Created", icon: <Tag className={I.c} /> },
  coupon_edit: { label: "Coupon Edited", icon: <Tag className={I.c} /> },
  coupon_delete: { label: "Coupon Deleted", icon: <Tag className={I.c} /> },
  bulk_import_packs: { label: "Bulk Import Packs", icon: <Package className={I.c} /> },
  update_stock: { label: "Stock Updated", icon: <Package className={I.c} /> },
  // Fraud Alerts
  fraud_alert_status: { label: "Fraud Alert Status", icon: <AlertTriangle className={I.c} /> },
  fraud_alert_assign: { label: "Fraud Alert Assigned", icon: <UserCog className={I.c} /> },
  fraud_alert_escalate: { label: "Fraud Alert Escalated", icon: <AlertTriangle className={I.c} /> },
  fraud_alert_delete: { label: "Fraud Alert Deleted", icon: <Trash2 className={I.c} /> },
  fraud_investigate: { label: "Fraud Investigated", icon: <Search className={I.c} /> },
  // Notifications & Charges
  notification_send: { label: "Notification Sent", icon: <Send className={I.c} /> },
  charge_config_create: { label: "Charge Config Created", icon: <Plus className={I.c} /> },
  charge_config_edit: { label: "Charge Config Edited", icon: <Pencil className={I.c} /> },
  charge_config_delete: { label: "Charge Config Deleted", icon: <Trash2 className={I.c} /> },
  charge_config_toggle: { label: "Charge Config Toggled", icon: <ToggleLeft className={I.c} /> },
  approve_api_request: { label: "API Request Approved", icon: <CheckCircle className={I.c} /> },
  reject_api_request: { label: "API Request Rejected", icon: <XCircle className={I.c} /> },
};

function formatAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function AdminAuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminProfiles, setAdminProfiles] = useState<Record<string, AdminProfile>>({});
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;

    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    // Category filter
    if (categoryFilter && categoryFilter !== "all") {
      if (categoryFilter === "other") {
        query = query.not("action", "in", `(${ALL_KNOWN_ACTIONS.join(",")})`);
      } else {
        const cat = CATEGORY_MAP[categoryFilter];
        if (cat) query = query.in("action", cat.actions);
      }
    }

    if (dateFrom) {
      query = query.gte("created_at", dateFrom.toISOString());
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endOfDay.toISOString());
    }
    if (adminFilter && adminFilter !== "all") {
      query = query.eq("actor_id", adminFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch audit logs:", error);
      setLoading(false);
      return;
    }

    const entries = (data ?? []) as AuditLogEntry[];
    const newLogs = reset ? entries : [...logs, ...entries];
    setLogs(newLogs);
    setHasMore(entries.length === PAGE_SIZE);
    if (reset) setOffset(PAGE_SIZE);
    else setOffset(currentOffset + PAGE_SIZE);

    const actorIds = [...new Set(newLogs.map(l => l.actor_id))];
    const missing = actorIds.filter(id => !adminProfiles[id]);
    if (missing.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", missing);
      if (profiles) {
        const map = { ...adminProfiles };
        profiles.forEach(p => { map[p.user_id] = p; });
        setAdminProfiles(map);
      }
    }

    setLoading(false);
  }, [offset, dateFrom, dateTo, adminFilter, categoryFilter, logs, adminProfiles]);

  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, adminFilter, categoryFilter]);

  const distinctAdmins = [...new Set(logs.map(l => l.actor_id))];

  const getAdminLabel = (actorId: string) => {
    const p = adminProfiles[actorId];
    if (p?.name) return p.name;
    if (p?.phone) return p.phone;
    return actorId.slice(0, 8) + "…";
  };

  const renderActionBadge = (action: string) => {
    const meta = ACTION_META[action];
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        {meta ? <>{meta.icon} {meta.label}</> : <><Shield className="w-3 h-3" /> {formatAction(action)}</>}
      </Badge>
    );
  };

  const renderTarget = (log: AuditLogEntry) => {
    if (log.action === "view_user_profile") {
      return (
        <span>{log.details?.viewed_user_name || "—"} <span className="text-muted-foreground text-xs">({log.details?.viewed_user_phone || "—"})</span></span>
      );
    }
    if (log.action === "view_all_profiles") {
      return <span className="text-muted-foreground text-xs">{log.details?.count ?? "—"} users loaded</span>;
    }
    if (log.entity_type && log.entity_id) {
      return <span className="text-xs">{log.entity_type}: {log.entity_id.slice(0, 8)}…</span>;
    }
    return <span className="text-muted-foreground text-xs">—</span>;
  };

  const renderDetails = (log: AuditLogEntry) => {
    if (!log.details) return "—";
    try {
      const str = JSON.stringify(log.details);
      return str.length > 60 ? str.slice(0, 60) + "…" : str;
    } catch {
      return "—";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="w-5 h-5" /> Audit Log
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full sm:w-[150px] justify-start text-left font-normal text-xs", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                  {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full sm:w-[150px] justify-start text-left font-normal text-xs", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                  {dateTo ? format(dateTo, "MMM d, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(CATEGORY_MAP).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Admin</label>
            <Select value={adminFilter} onValueChange={setAdminFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
                <SelectValue placeholder="All admins" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All admins</SelectItem>
                {distinctAdmins.map(id => (
                  <SelectItem key={id} value={id}>{getAdminLabel(id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(dateFrom || dateTo || adminFilter !== "all" || categoryFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setAdminFilter("all"); setCategoryFilter("all"); }} className="col-span-2 sm:col-span-1">
              Clear
            </Button>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Date / Time</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                        <FileText className="w-7 h-7 text-muted-foreground" />
                      </motion.div>
                      <p className="text-sm font-semibold text-foreground">No audit log entries found</p>
                      <p className="text-xs text-muted-foreground mt-1">Audit logs will appear here</p>
                    </motion.div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">{getAdminLabel(log.actor_id)}</TableCell>
                    <TableCell>{renderActionBadge(log.action)}</TableCell>
                    <TableCell className="text-sm">{renderTarget(log)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {renderDetails(log)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {logs.length === 0 && !loading ? (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="flex flex-col items-center justify-center py-8 text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">No audit log entries found</p>
              <p className="text-xs text-muted-foreground mt-1">Audit logs will appear here</p>
            </motion.div>
          ) : (
            logs.map(log => (
              <Card key={log.id} className="border border-border/50">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    {renderActionBadge(log.action)}
                    <span className="text-[10px] text-muted-foreground">{format(new Date(log.created_at), "MMM d, HH:mm")}</span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{getAdminLabel(log.actor_id)}</p>
                  <div className="text-xs text-muted-foreground">{renderTarget(log)}</div>
                  <p className="text-[10px] text-muted-foreground/70 truncate">{renderDetails(log)}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {hasMore && logs.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => fetchLogs(false)} disabled={loading}>
              {loading ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}

        {loading && logs.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
