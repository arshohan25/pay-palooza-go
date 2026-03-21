import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Users, Plus, Shield } from "lucide-react";

const mockStaff = [
  { id: "1", name: "Rahim Uddin", phone: "01712345678", role: "Manager", active: true },
  { id: "2", name: "Fatema Begum", phone: "01898765432", role: "Cashier", active: true },
  { id: "3", name: "Sumon Das", phone: "01556781234", role: "Viewer", active: false },
];

const roleColors: Record<string, string> = {
  Manager: "bg-primary/10 text-primary border-primary/20",
  Cashier: "bg-blue-500/10 text-blue-700 border-blue-200",
  Viewer:  "bg-muted text-muted-foreground border-border",
};

export default function MerchantStaffTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Users size={18} className="text-primary" /> Staff Accounts
        </h3>
        <Button size="sm" className="h-8 text-xs">
          <Plus size={13} className="mr-1" /> Add Staff
        </Button>
      </div>

      <Card className="border-0 shadow-elevated">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-primary" />
            <p className="text-xs font-semibold text-foreground">Role Permissions</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
            <div><p className="font-semibold text-foreground">Manager</p><p>Full access, manage staff</p></div>
            <div><p className="font-semibold text-foreground">Cashier</p><p>Process orders, view products</p></div>
            <div><p className="font-semibold text-foreground">Viewer</p><p>View-only, no actions</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {mockStaff.map(s => (
          <Card key={s.id} className="border-0 shadow-elevated">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-bold text-foreground">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`text-[9px] ${roleColors[s.role]}`}>{s.role}</Badge>
                  <Switch checked={s.active} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
