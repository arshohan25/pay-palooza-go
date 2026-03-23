import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Loader2, User, Store, Building2, UserCheck } from "lucide-react";

interface AdminProfileEditorProps {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

interface ProfileData {
  name: string;
  phone: string;
  email: string;
  avatar_url: string;
}

interface AgentData {
  id: string;
  business_name: string;
  nid_number: string;
  territory_code: string;
  trade_license: string;
  max_float: number;
}

interface MerchantData {
  id: string;
  business_name: string;
  category: string;
  mdr_rate: number;
  settlement_frequency: string;
  bank_name: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_branch: string;
  bank_routing: string;
  trade_license: string;
}

interface DistributorData {
  id: string;
  business_name: string;
  commission_rate: number;
  max_float: number;
  territory: string[];
}

export default function AdminProfileEditor({ userId, onClose, onSaved }: AdminProfileEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({ name: "", phone: "", email: "", avatar_url: "" });
  const [originalProfile, setOriginalProfile] = useState<ProfileData>({ name: "", phone: "", email: "", avatar_url: "" });

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [originalAgent, setOriginalAgent] = useState<AgentData | null>(null);

  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [originalMerchant, setOriginalMerchant] = useState<MerchantData | null>(null);

  const [distributor, setDistributor] = useState<DistributorData | null>(null);
  const [originalDistributor, setOriginalDistributor] = useState<DistributorData | null>(null);

  const [territoryInput, setTerritoryInput] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [profileRes, agentRes, merchantRes, distributorRes] = await Promise.all([
        supabase.from("profiles").select("name, phone, email, avatar_url").eq("user_id", userId).maybeSingle(),
        supabase.from("agents").select("id, business_name, nid_number, territory_code, trade_license, max_float").eq("user_id", userId).maybeSingle(),
        supabase.from("merchants").select("id, business_name, category, mdr_rate, settlement_frequency, bank_name, bank_account_holder, bank_account_number, bank_branch, bank_routing, trade_license").eq("user_id", userId).maybeSingle(),
        supabase.from("distributors").select("id, business_name, commission_rate, max_float, territory").eq("user_id", userId).maybeSingle(),
      ]);

      const p: ProfileData = {
        name: profileRes.data?.name || "",
        phone: profileRes.data?.phone || "",
        email: profileRes.data?.email || "",
        avatar_url: profileRes.data?.avatar_url || "",
      };
      setProfile(p);
      setOriginalProfile({ ...p });

      if (agentRes.data) {
        const a: AgentData = {
          id: agentRes.data.id,
          business_name: agentRes.data.business_name || "",
          nid_number: agentRes.data.nid_number || "",
          territory_code: agentRes.data.territory_code || "",
          trade_license: agentRes.data.trade_license || "",
          max_float: agentRes.data.max_float ?? 0,
        };
        setAgent(a);
        setOriginalAgent({ ...a });
      }

      if (merchantRes.data) {
        const m: MerchantData = {
          id: merchantRes.data.id,
          business_name: merchantRes.data.business_name || "",
          category: merchantRes.data.category || "",
          mdr_rate: merchantRes.data.mdr_rate ?? 0,
          settlement_frequency: merchantRes.data.settlement_frequency || "",
          bank_name: merchantRes.data.bank_name || "",
          bank_account_holder: merchantRes.data.bank_account_holder || "",
          bank_account_number: merchantRes.data.bank_account_number || "",
          bank_branch: merchantRes.data.bank_branch || "",
          bank_routing: merchantRes.data.bank_routing || "",
          trade_license: merchantRes.data.trade_license || "",
        };
        setMerchant(m);
        setOriginalMerchant({ ...m });
      }

      if (distributorRes.data) {
        const d: DistributorData = {
          id: distributorRes.data.id,
          business_name: distributorRes.data.business_name || "",
          commission_rate: distributorRes.data.commission_rate ?? 0,
          max_float: distributorRes.data.max_float ?? 0,
          territory: distributorRes.data.territory || [],
        };
        setDistributor(d);
        setOriginalDistributor({ ...d });
        setTerritoryInput((distributorRes.data.territory || []).join(", "));
      }

      setLoading(false);
    };
    fetchData();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes: Record<string, { before: any; after: any }> = {};

      // Update profile
      const profileUpdate: Record<string, any> = {};
      if (profile.name !== originalProfile.name) { profileUpdate.name = profile.name; changes.name = { before: originalProfile.name, after: profile.name }; }
      if (profile.email !== originalProfile.email) { profileUpdate.email = profile.email; changes.email = { before: originalProfile.email, after: profile.email }; }
      if (profile.avatar_url !== originalProfile.avatar_url) { profileUpdate.avatar_url = profile.avatar_url; changes.avatar_url = { before: originalProfile.avatar_url, after: profile.avatar_url }; }

      if (Object.keys(profileUpdate).length > 0) {
        const { error } = await supabase.from("profiles").update(profileUpdate).eq("user_id", userId);
        if (error) throw error;
      }

      // Update agent
      if (agent && originalAgent) {
        const agentUpdate: Record<string, any> = {};
        if (agent.business_name !== originalAgent.business_name) { agentUpdate.business_name = agent.business_name; changes.agent_business_name = { before: originalAgent.business_name, after: agent.business_name }; }
        if (agent.nid_number !== originalAgent.nid_number) { agentUpdate.nid_number = agent.nid_number; changes.agent_nid_number = { before: originalAgent.nid_number, after: agent.nid_number }; }
        if (agent.territory_code !== originalAgent.territory_code) { agentUpdate.territory_code = agent.territory_code; changes.agent_territory_code = { before: originalAgent.territory_code, after: agent.territory_code }; }
        if (agent.trade_license !== originalAgent.trade_license) { agentUpdate.trade_license = agent.trade_license; changes.agent_trade_license = { before: originalAgent.trade_license, after: agent.trade_license }; }
        if (agent.max_float !== originalAgent.max_float) { agentUpdate.max_float = agent.max_float; changes.agent_max_float = { before: originalAgent.max_float, after: agent.max_float }; }

        if (Object.keys(agentUpdate).length > 0) {
          const { error } = await supabase.from("agents").update(agentUpdate).eq("id", agent.id);
          if (error) throw error;
        }
      }

      // Update merchant
      if (merchant && originalMerchant) {
        const merchantUpdate: Record<string, any> = {};
        const mFields: (keyof MerchantData)[] = ["business_name", "category", "mdr_rate", "settlement_frequency", "bank_name", "bank_account_holder", "bank_account_number", "bank_branch", "bank_routing", "trade_license"];
        for (const f of mFields) {
          if (merchant[f] !== originalMerchant[f]) {
            merchantUpdate[f] = merchant[f];
            changes[`merchant_${f}`] = { before: originalMerchant[f], after: merchant[f] };
          }
        }
        if (Object.keys(merchantUpdate).length > 0) {
          const { error } = await supabase.from("merchants").update(merchantUpdate).eq("id", merchant.id);
          if (error) throw error;
        }
      }

      // Update distributor
      if (distributor && originalDistributor) {
        const distUpdate: Record<string, any> = {};
        if (distributor.business_name !== originalDistributor.business_name) { distUpdate.business_name = distributor.business_name; changes.distributor_business_name = { before: originalDistributor.business_name, after: distributor.business_name }; }
        if (distributor.commission_rate !== originalDistributor.commission_rate) { distUpdate.commission_rate = distributor.commission_rate; changes.distributor_commission_rate = { before: originalDistributor.commission_rate, after: distributor.commission_rate }; }
        if (distributor.max_float !== originalDistributor.max_float) { distUpdate.max_float = distributor.max_float; changes.distributor_max_float = { before: originalDistributor.max_float, after: distributor.max_float }; }
        const newTerritory = territoryInput.split(",").map(t => t.trim()).filter(Boolean);
        if (JSON.stringify(newTerritory) !== JSON.stringify(originalDistributor.territory)) {
          distUpdate.territory = newTerritory;
          changes.distributor_territory = { before: originalDistributor.territory, after: newTerritory };
        }

        if (Object.keys(distUpdate).length > 0) {
          const { error } = await supabase.from("distributors").update(distUpdate).eq("id", distributor.id);
          if (error) throw error;
        }
      }

      if (Object.keys(changes).length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }

      // Audit log
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("audit_logs").insert({
          actor_id: session.user.id,
          action: "admin_edit_profile",
          entity_type: "user",
          entity_id: userId,
          details: changes as any,
        });
      }

      toast.success("Profile updated successfully");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value, onChange, type = "text", placeholder }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-lg">Edit User Profile</DialogTitle>
          <DialogDescription className="text-sm">
            Modify profile, agent, merchant, or distributor details. All changes are audited.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] px-6">
            <div className="space-y-6 pb-6">
              {/* Profile Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm text-foreground">Profile</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name" value={profile.name} onChange={(v) => setProfile(p => ({ ...p, name: v }))} placeholder="Full Name" />
                  <Field label="Phone" value={profile.phone} onChange={(v) => setProfile(p => ({ ...p, phone: v }))} placeholder="01XXXXXXXXX" />
                  <Field label="Email" value={profile.email} onChange={(v) => setProfile(p => ({ ...p, email: v }))} placeholder="user@example.com" />
                  <Field label="Avatar URL" value={profile.avatar_url} onChange={(v) => setProfile(p => ({ ...p, avatar_url: v }))} placeholder="https://..." />
                </div>
              </div>

              {/* Agent Section */}
              {agent && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      <h4 className="font-semibold text-sm text-foreground">Agent</h4>
                      <Badge variant="outline" className="text-[10px] h-5">Agent</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Business Name" value={agent.business_name} onChange={(v) => setAgent(a => a ? { ...a, business_name: v } : a)} />
                      <Field label="NID Number" value={agent.nid_number} onChange={(v) => setAgent(a => a ? { ...a, nid_number: v } : a)} />
                      <Field label="Territory Code" value={agent.territory_code} onChange={(v) => setAgent(a => a ? { ...a, territory_code: v } : a)} />
                      <Field label="Trade License" value={agent.trade_license} onChange={(v) => setAgent(a => a ? { ...a, trade_license: v } : a)} />
                      <Field label="Max Float" value={agent.max_float} type="number" onChange={(v) => setAgent(a => a ? { ...a, max_float: parseFloat(v) || 0 } : a)} />
                    </div>
                  </div>
                </>
              )}

              {/* Merchant Section */}
              {merchant && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-blue-600" />
                      <h4 className="font-semibold text-sm text-foreground">Merchant</h4>
                      <Badge variant="outline" className="text-[10px] h-5">Merchant</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Business Name" value={merchant.business_name} onChange={(v) => setMerchant(m => m ? { ...m, business_name: v } : m)} />
                      <Field label="Category" value={merchant.category} onChange={(v) => setMerchant(m => m ? { ...m, category: v } : m)} />
                      <Field label="MDR Rate (%)" value={merchant.mdr_rate} type="number" onChange={(v) => setMerchant(m => m ? { ...m, mdr_rate: parseFloat(v) || 0 } : m)} />
                      <Field label="Settlement Frequency" value={merchant.settlement_frequency} onChange={(v) => setMerchant(m => m ? { ...m, settlement_frequency: v } : m)} />
                      <Field label="Trade License" value={merchant.trade_license} onChange={(v) => setMerchant(m => m ? { ...m, trade_license: v } : m)} />
                    </div>
                    <Separator className="my-2" />
                    <p className="text-xs font-medium text-muted-foreground">Bank Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bank Name" value={merchant.bank_name} onChange={(v) => setMerchant(m => m ? { ...m, bank_name: v } : m)} />
                      <Field label="Account Holder" value={merchant.bank_account_holder} onChange={(v) => setMerchant(m => m ? { ...m, bank_account_holder: v } : m)} />
                      <Field label="Account Number" value={merchant.bank_account_number} onChange={(v) => setMerchant(m => m ? { ...m, bank_account_number: v } : m)} />
                      <Field label="Branch" value={merchant.bank_branch} onChange={(v) => setMerchant(m => m ? { ...m, bank_branch: v } : m)} />
                      <Field label="Routing Number" value={merchant.bank_routing} onChange={(v) => setMerchant(m => m ? { ...m, bank_routing: v } : m)} />
                    </div>
                  </div>
                </>
              )}

              {/* Distributor Section */}
              {distributor && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-purple-600" />
                      <h4 className="font-semibold text-sm text-foreground">Distributor</h4>
                      <Badge variant="outline" className="text-[10px] h-5">Distributor</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Business Name" value={distributor.business_name} onChange={(v) => setDistributor(d => d ? { ...d, business_name: v } : d)} />
                      <Field label="Commission Rate (%)" value={distributor.commission_rate} type="number" onChange={(v) => setDistributor(d => d ? { ...d, commission_rate: parseFloat(v) || 0 } : d)} />
                      <Field label="Max Float" value={distributor.max_float} type="number" onChange={(v) => setDistributor(d => d ? { ...d, max_float: parseFloat(v) || 0 } : d)} />
                      <div className="col-span-2">
                        <Field label="Territory (comma-separated)" value={territoryInput} onChange={setTerritoryInput} placeholder="Dhaka, Chittagong, Sylhet" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
