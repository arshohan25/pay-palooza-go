import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Save, Plus, X, Users, Globe, Target, Ban, Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const ALL_ROLES = [
  { value: "user", label: "Regular User" },
  { value: "agent", label: "Agent" },
  { value: "distributor", label: "Distributor" },
  { value: "super_distributor", label: "Super Distributor" },
];

interface Config {
  id: string;
  mode: string;
  allowed_roles: string[];
  allowed_areas: string[];
  allowed_user_ids: string[];
  blocked_user_ids: string[];
}

export default function MerchantApplyTargeting() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [mode, setMode] = useState("all");
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [allowedAreas, setAllowedAreas] = useState<string[]>([]);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  // Input fields
  const [areaInput, setAreaInput] = useState("");
  const [allowPhoneInput, setAllowPhoneInput] = useState("");
  const [blockPhoneInput, setBlockPhoneInput] = useState("");
  const [searchingPhone, setSearchingPhone] = useState(false);

  // Resolved phone->name maps
  const [allowedProfiles, setAllowedProfiles] = useState<Record<string, string>>({});
  const [blockedProfiles, setBlockedProfiles] = useState<Record<string, string>>({});

  const fetchConfig = useCallback(async () => {
    const { data } = await (supabase as any).from("merchant_apply_config").select("*").limit(1).maybeSingle();
    if (data) {
      setConfig(data);
      setMode(data.mode);
      setAllowedRoles(data.allowed_roles || []);
      setAllowedAreas(data.allowed_areas || []);
      setAllowedUserIds(data.allowed_user_ids || []);
      setBlockedUserIds(data.blocked_user_ids || []);
      // Resolve profiles
      const allIds = [...(data.allowed_user_ids || []), ...(data.blocked_user_ids || [])];
      if (allIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, phone, name").in("user_id", allIds);
        const allowMap: Record<string, string> = {};
        const blockMap: Record<string, string> = {};
        (profiles ?? []).forEach(p => {
          const label = `${p.phone}${p.name ? ` (${p.name})` : ""}`;
          if ((data.allowed_user_ids || []).includes(p.user_id)) allowMap[p.user_id] = label;
          if ((data.blocked_user_ids || []).includes(p.user_id)) blockMap[p.user_id] = label;
        });
        setAllowedProfiles(allowMap);
        setBlockedProfiles(blockMap);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const resolvePhone = async (phone: string): Promise<{ user_id: string; label: string } | null> => {
    setSearchingPhone(true);
    const { data } = await supabase.from("profiles").select("user_id, phone, name").eq("phone", phone.trim()).maybeSingle();
    setSearchingPhone(false);
    if (!data) { toast.error("No user found with that phone"); return null; }
    return { user_id: data.user_id, label: `${data.phone}${data.name ? ` (${data.name})` : ""}` };
  };

  const addAllowedUser = async () => {
    if (!allowPhoneInput.trim()) return;
    const result = await resolvePhone(allowPhoneInput);
    if (!result) return;
    if (allowedUserIds.includes(result.user_id)) { toast.info("Already in list"); return; }
    setAllowedUserIds(prev => [...prev, result.user_id]);
    setAllowedProfiles(prev => ({ ...prev, [result.user_id]: result.label }));
    setAllowPhoneInput("");
  };

  const addBlockedUser = async () => {
    if (!blockPhoneInput.trim()) return;
    const result = await resolvePhone(blockPhoneInput);
    if (!result) return;
    if (blockedUserIds.includes(result.user_id)) { toast.info("Already in list"); return; }
    setBlockedUserIds(prev => [...prev, result.user_id]);
    setBlockedProfiles(prev => ({ ...prev, [result.user_id]: result.label }));
    setBlockPhoneInput("");
  };

  const addArea = () => {
    const area = areaInput.trim();
    if (!area) return;
    if (allowedAreas.includes(area)) { toast.info("Already added"); return; }
    setAllowedAreas(prev => [...prev, area]);
    setAreaInput("");
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await (supabase as any).from("merchant_apply_config").update({
      mode,
      allowed_roles: allowedRoles,
      allowed_areas: allowedAreas,
      allowed_user_ids: allowedUserIds,
      blocked_user_ids: blockedUserIds,
      updated_by: session?.user?.id,
      updated_at: new Date().toISOString(),
    }).eq("id", config.id);
    if (error) toast.error("Failed to save: " + error.message);
    else toast.success("Targeting config saved");
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4" /> Feature Visibility Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={setMode} className="space-y-2">
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="all" id="mode-all" />
              <Label htmlFor="mode-all" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Everyone</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">All users can see &ldquo;Become a Merchant&rdquo;</p>
              </Label>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="targeted" id="mode-targeted" />
              <Label htmlFor="mode-targeted" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Targeted</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Only matching users by role, area, or individual selection</p>
              </Label>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="none" id="mode-none" />
              <Label htmlFor="mode-none" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium">Disabled</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">No one can see &ldquo;Become a Merchant&rdquo;</p>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {mode === "targeted" && (
        <>
          {/* Role filter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Allowed Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Users with any of these roles can see the feature. Leave empty to skip role filtering.</p>
              <div className="flex flex-wrap gap-3">
                {ALL_ROLES.map(role => (
                  <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={allowedRoles.includes(role.value)}
                      onCheckedChange={checked => {
                        setAllowedRoles(prev =>
                          checked ? [...prev, role.value] : prev.filter(r => r !== role.value)
                        );
                      }}
                    />
                    <span className="text-sm">{role.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Area filter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Allowed Areas / Territory Codes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Only users in these territory areas can see it. Leave empty to skip area filtering.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter area code..."
                  value={areaInput}
                  onChange={e => setAreaInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addArea()}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addArea}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allowedAreas.map(area => (
                  <Badge key={area} variant="secondary" className="text-xs gap-1">
                    {area}
                    <button onClick={() => setAllowedAreas(prev => prev.filter(a => a !== area))}><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Individual users whitelist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Whitelisted Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">These specific users can always see the feature, regardless of other filters.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Phone number..."
                  value={allowPhoneInput}
                  onChange={e => setAllowPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addAllowedUser()}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addAllowedUser} disabled={searchingPhone}>
                  {searchingPhone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allowedUserIds.map(uid => (
                  <Badge key={uid} variant="secondary" className="text-xs gap-1">
                    {allowedProfiles[uid] || uid.slice(0, 8)}
                    <button onClick={() => {
                      setAllowedUserIds(prev => prev.filter(u => u !== uid));
                      setAllowedProfiles(prev => { const n = { ...prev }; delete n[uid]; return n; });
                    }}><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Blocked users - always visible */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Ban className="w-4 h-4 text-destructive" /> Blocked Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">These users will never see &ldquo;Become a Merchant&rdquo;, regardless of other settings.</p>
          <div className="flex gap-2">
            <Input
              placeholder="Phone number..."
              value={blockPhoneInput}
              onChange={e => setBlockPhoneInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addBlockedUser()}
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={addBlockedUser} disabled={searchingPhone}>
              {searchingPhone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {blockedUserIds.map(uid => (
              <Badge key={uid} variant="destructive" className="text-xs gap-1">
                {blockedProfiles[uid] || uid.slice(0, 8)}
                <button onClick={() => {
                  setBlockedUserIds(prev => prev.filter(u => u !== uid));
                  setBlockedProfiles(prev => { const n = { ...prev }; delete n[uid]; return n; });
                }}><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Button onClick={saveConfig} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Targeting Config
      </Button>
    </div>
  );
}
