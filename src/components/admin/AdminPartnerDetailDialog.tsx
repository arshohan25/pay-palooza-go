import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Store, UserCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Kind = "agent" | "merchant";

interface Props {
  kind: Kind;
  record: any | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground text-right break-all">{String(value)}</span>
    </div>
  );
}

const AGENT_FIELDS: [string, string][] = [
  ["Business name", "business_name"],
  ["Shop name", "shop_name"],
  ["Territory", "territory_code"],
  ["Division", "division"],
  ["District", "district"],
  ["Upazila", "upazila"],
  ["Union", "union_parishad"],
  ["Address", "address"],
  ["Area type", "area_type"],
  ["NID number", "nid_number"],
  ["Trade license", "trade_license"],
  ["Max float", "max_float"],
  ["Commission earned", "commission_earned"],
  ["Customers onboarded", "customers_onboarded"],
  ["Avg rating", "avg_rating"],
  ["Total ratings", "total_ratings"],
  ["Available", "is_available"],
  ["Distributor ID", "distributor_id"],
  ["Activated at", "activated_at"],
  ["Created at", "created_at"],
];

const MERCHANT_FIELDS: [string, string][] = [
  ["Business name", "business_name"],
  ["Business name (BN)", "business_name_bn"],
  ["Category", "category"],
  ["Owner name", "owner_name"],
  ["Contact number", "contact_number"],
  ["Contact email", "contact_email"],
  ["Business address", "business_address"],
  ["Business KYC", "business_kyc_status"],
  ["MDR rate", "mdr_rate"],
  ["Commission rate", "commission_rate"],
  ["Service charge enabled", "service_charge_enabled"],
  ["Service charge rate", "service_charge_rate"],
  ["Settlement frequency", "settlement_frequency"],
  ["Bank name", "bank_name"],
  ["Bank account holder", "bank_account_holder"],
  ["Bank account number", "bank_account_number"],
  ["Bank branch", "bank_branch"],
  ["Bank routing", "bank_routing"],
  ["Admin notes", "admin_notes"],
  ["Created at", "created_at"],
];

export default function AdminPartnerDetailDialog({ kind, record, onClose }: Props) {
  const navigate = useNavigate();
  const fields = kind === "agent" ? AGENT_FIELDS : MERCHANT_FIELDS;
  const Icon = kind === "agent" ? UserCheck : Store;

  return (
    <Dialog open={!!record} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90svh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon className="w-4 h-4 text-primary" />
            {kind === "agent" ? "Agent details" : "Merchant details"}
          </DialogTitle>
        </DialogHeader>

        {record && (
          <ScrollArea className="max-h-[65svh] pr-3">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {record.business_name || record.shop_name || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.owner_name || "Unknown owner"}
                    {record.owner_phone ? ` · ${record.owner_phone}` : ""}
                  </p>
                </div>
                <Badge
                  variant={record.status === "suspended" ? "destructive" : record.status === "active" ? "secondary" : "outline"}
                  className="text-xs shrink-0"
                >
                  {record.status}
                </Badge>
              </div>

              <div className="rounded-xl border border-border/50 p-3">
                <Row label="EasyPay UID" value={record.easypay_uid} />
                <Row label="Owner phone" value={record.owner_phone} />
                <Row
                  label="Wallet balance"
                  value={record.owner_balance !== null && record.owner_balance !== undefined ? `৳${Number(record.owner_balance).toLocaleString()}` : null}
                />
                <Row label="Account status" value={record.owner_profile?.status} />
              </div>

              <div className="rounded-xl border border-border/50 p-3">
                {fields.map(([label, key]) => (
                  <Row key={key} label={label} value={record[key]} />
                ))}
              </div>

              {record.easypay_uid && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => { onClose(); navigate(`/admin/users/${record.easypay_uid}`); }}
                >
                  <ExternalLink className="w-4 h-4" /> Open owner profile
                </Button>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
