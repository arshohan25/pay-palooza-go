import React, { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Download, Shield, FileText, AlertTriangle, User, CreditCard, Smartphone, Key } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";

interface UserReport {
  profile: any;
  kyc: any;
  transactions: any[];
  devices: any[];
  roles: any[];
}

export default function AdminLEARequest() {
  const [phone, setPhone] = useState("");
  const [authority, setAuthority] = useState("");
  const [refNo, setRefNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<UserReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const logAction = async (action: string, details: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action,
        entity_type: "lea_request",
        entity_id: details.user_id || session.user.id,
        details,
      }).then();
    }
  };

  const handleSearch = async () => {
    if (!phone.trim()) return toast.error("Enter a phone number");
    setLoading(true);
    setReport(null);

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("phone", phone.trim())
        .maybeSingle();

      if (error) throw error;
      if (!profile) {
        toast.error("No user found with this number");
        setLoading(false);
        return;
      }

      const userId = profile.user_id;

      const [kycRes, txnRes, devRes, rolesRes] = await Promise.all([
        supabase.from("kyc_verifications").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("device_registrations").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role, created_at").eq("user_id", userId),
      ]);

      setReport({
        profile,
        kyc: kycRes.data,
        transactions: txnRes.data ?? [],
        devices: devRes.data ?? [],
        roles: rolesRes.data ?? [],
      });

      await logAction("lea_data_search", { phone: phone.trim(), user_id: userId });
      toast.success("User data retrieved");
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const generateReportId = () => {
    const d = new Date();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LEA-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${rand}`;
  };

  const handleDownload = async () => {
    if (!authority.trim()) return toast.error("Enter Requesting Authority");
    if (!refNo.trim()) return toast.error("Enter Reference Number");
    if (!reportRef.current) return;

    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `LEA-Report-${phone}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      await logAction("lea_report_download", {
        phone: phone.trim(),
        user_id: report?.profile?.user_id,
        authority: authority.trim(),
        reference_no: refNo.trim(),
      });

      toast.success("Report downloaded");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const totalIn = report?.transactions.filter(t => ["receive", "cashin", "add_money", "refund"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const totalOut = report?.transactions.filter(t => ["send", "cashout", "payment", "bill_pay", "recharge"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-destructive" />
            Law Enforcement Data Request
          </CardTitle>
          <p className="text-xs text-muted-foreground">Search user by phone number. All searches are logged for audit.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Enter phone number (e.g. 01XXXXXXXXX)" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} />
            <Button onClick={handleSearch} disabled={loading} className="shrink-0">
              <Search className="w-4 h-4 mr-1" />{loading ? "..." : "Search"}
            </Button>
          </div>
          {report && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Requesting Authority *" value={authority} onChange={e => setAuthority(e.target.value)} />
              <Input placeholder="Reference No *" value={refNo} onChange={e => setRefNo(e.target.value)} />
              <Button onClick={handleDownload} disabled={generating} variant="destructive" className="shrink-0">
                <Download className="w-4 h-4 mr-1" />{generating ? "Generating..." : "Download Report"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* On-screen preview */}
      {report && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Account Info */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1 mb-2"><User className="w-4 h-4" /> Account Information</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Name</span><span className="font-medium">{report.profile.name || "—"}</span>
                <span className="text-muted-foreground">Phone</span><span className="font-medium">{report.profile.phone}</span>
                <span className="text-muted-foreground">Status</span><span><Badge variant={report.profile.status === "active" ? "default" : "destructive"} className="text-[10px]">{report.profile.status}</Badge></span>
                <span className="text-muted-foreground">Balance</span><span className="font-medium">৳{Number(report.profile.balance || 0).toLocaleString()}</span>
                <span className="text-muted-foreground">Registered</span><span className="font-medium">{new Date(report.profile.created_at).toLocaleDateString()}</span>
                <span className="text-muted-foreground">Referral Code</span><span className="font-medium">{report.profile.referral_code || "—"}</span>
              </div>
            </div>
            <Separator />

            {/* KYC */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1 mb-2"><FileText className="w-4 h-4" /> KYC / Identity</h3>
              {report.kyc ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">NID Number</span><span className="font-medium">{report.kyc.nid_number || "—"}</span>
                  <span className="text-muted-foreground">Full Name (NID)</span><span className="font-medium">{report.kyc.full_name || "—"}</span>
                  <span className="text-muted-foreground">Date of Birth</span><span className="font-medium">{report.kyc.date_of_birth || "—"}</span>
                  <span className="text-muted-foreground">KYC Status</span><span><Badge className="text-[10px]">{report.kyc.status}</Badge></span>
                  <span className="text-muted-foreground">Face Match</span><span className="font-medium">{report.kyc.face_match_result || "—"} {report.kyc.face_match_score ? `(${report.kyc.face_match_score}%)` : ""}</span>
                  <span className="text-muted-foreground">Verified On</span><span className="font-medium">{report.kyc.reviewed_at ? new Date(report.kyc.reviewed_at).toLocaleDateString() : "—"}</span>
                </div>
              ) : <p className="text-xs text-muted-foreground">No KYC data found</p>}
            </div>
            <Separator />

            {/* Transactions */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1 mb-2"><CreditCard className="w-4 h-4" /> Transactions ({report.transactions.length})</h3>
              <div className="max-h-60 overflow-auto border rounded text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr><th className="p-1.5 text-left">Date</th><th className="p-1.5 text-left">Type</th><th className="p-1.5 text-right">Amount</th><th className="p-1.5 text-right">Fee</th><th className="p-1.5 text-left">Recipient</th><th className="p-1.5 text-left">Ref</th><th className="p-1.5 text-left">Status</th></tr>
                  </thead>
                  <tbody>
                    {report.transactions.slice(0, 500).map((t, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1.5 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                        <td className="p-1.5">{t.type}</td>
                        <td className="p-1.5 text-right">৳{Number(t.amount).toLocaleString()}</td>
                        <td className="p-1.5 text-right">৳{Number(t.fee || 0).toLocaleString()}</td>
                        <td className="p-1.5">{t.recipient || "—"}</td>
                        <td className="p-1.5">{t.reference || "—"}</td>
                        <td className="p-1.5">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Separator />

            {/* Devices */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1 mb-2"><Smartphone className="w-4 h-4" /> Registered Devices ({report.devices.length})</h3>
              {report.devices.length > 0 ? (
                <div className="text-xs space-y-1">
                  {report.devices.map((d, i) => (
                    <div key={i} className="flex justify-between bg-muted/30 p-1.5 rounded">
                      <span className="font-mono text-[10px] truncate max-w-[60%]">{d.device_fingerprint}</span>
                      <span className="text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">No devices registered</p>}
            </div>
            <Separator />

            {/* Roles */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1 mb-2"><Key className="w-4 h-4" /> Roles & Permissions</h3>
              {report.roles.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {report.roles.map((r, i) => <Badge key={i} variant="outline" className="text-[10px]">{r.role}</Badge>)}
                </div>
              ) : <p className="text-xs text-muted-foreground">No roles assigned</p>}
            </div>

            {/* Summary */}
            <div className="bg-muted/30 p-3 rounded-lg text-xs grid grid-cols-3 gap-2 text-center">
              <div><p className="text-muted-foreground">Total Txns</p><p className="font-bold text-sm">{report.transactions.length}</p></div>
              <div><p className="text-muted-foreground">Total In</p><p className="font-bold text-sm text-emerald-600">৳{totalIn.toLocaleString()}</p></div>
              <div><p className="text-muted-foreground">Total Out</p><p className="font-bold text-sm text-red-600">৳{totalOut.toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden printable report for html2canvas */}
      {report && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <div ref={reportRef} style={{ width: 800, padding: 40, background: "#fff", color: "#111", fontFamily: "monospace", fontSize: 12 }}>
            <div style={{ textAlign: "center", marginBottom: 24, borderBottom: "2px solid #111", paddingBottom: 16 }}>
              <h1 style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 2 }}>EASYPAY — USER DATA DISCLOSURE REPORT</h1>
              <p style={{ fontSize: 11, color: "#c00", marginTop: 4 }}>CONFIDENTIAL — LAW ENFORCEMENT ONLY</p>
            </div>

            <table style={{ width: "100%", marginBottom: 16, fontSize: 12 }}>
              <tbody>
                <tr><td style={{ padding: 2 }}>Report ID:</td><td style={{ padding: 2, fontWeight: "bold" }}>{generateReportId()}</td></tr>
                <tr><td style={{ padding: 2 }}>Generated:</td><td style={{ padding: 2 }}>{new Date().toLocaleString()}</td></tr>
                <tr><td style={{ padding: 2 }}>Requesting Authority:</td><td style={{ padding: 2, fontWeight: "bold" }}>{authority || "_______________"}</td></tr>
                <tr><td style={{ padding: 2 }}>Reference No:</td><td style={{ padding: 2, fontWeight: "bold" }}>{refNo || "_______________"}</td></tr>
              </tbody>
            </table>

            <h2 style={{ fontSize: 13, borderBottom: "1px solid #ccc", paddingBottom: 4, marginTop: 20 }}>1. ACCOUNT INFORMATION</h2>
            <table style={{ width: "100%", fontSize: 12, marginBottom: 12 }}>
              <tbody>
                <tr><td style={{ padding: 2, width: 180 }}>Name:</td><td style={{ padding: 2 }}>{report.profile.name || "—"}</td></tr>
                <tr><td style={{ padding: 2 }}>Phone:</td><td style={{ padding: 2 }}>{report.profile.phone}</td></tr>
                <tr><td style={{ padding: 2 }}>Account Status:</td><td style={{ padding: 2 }}>{report.profile.status}</td></tr>
                <tr><td style={{ padding: 2 }}>Current Balance:</td><td style={{ padding: 2 }}>৳{Number(report.profile.balance || 0).toLocaleString()}</td></tr>
                <tr><td style={{ padding: 2 }}>Registration Date:</td><td style={{ padding: 2 }}>{new Date(report.profile.created_at).toLocaleDateString()}</td></tr>
                <tr><td style={{ padding: 2 }}>Referral Code:</td><td style={{ padding: 2 }}>{report.profile.referral_code || "—"}</td></tr>
              </tbody>
            </table>

            <h2 style={{ fontSize: 13, borderBottom: "1px solid #ccc", paddingBottom: 4, marginTop: 20 }}>2. KYC / IDENTITY</h2>
            {report.kyc ? (
              <table style={{ width: "100%", fontSize: 12, marginBottom: 12 }}>
                <tbody>
                  <tr><td style={{ padding: 2, width: 180 }}>NID Number:</td><td style={{ padding: 2 }}>{report.kyc.nid_number || "—"}</td></tr>
                  <tr><td style={{ padding: 2 }}>Full Name (NID):</td><td style={{ padding: 2 }}>{report.kyc.full_name || "—"}</td></tr>
                  <tr><td style={{ padding: 2 }}>Date of Birth:</td><td style={{ padding: 2 }}>{report.kyc.date_of_birth || "—"}</td></tr>
                  <tr><td style={{ padding: 2 }}>KYC Status:</td><td style={{ padding: 2 }}>{report.kyc.status}</td></tr>
                  <tr><td style={{ padding: 2 }}>Face Match:</td><td style={{ padding: 2 }}>{report.kyc.face_match_result || "—"} {report.kyc.face_match_score ? `(${report.kyc.face_match_score}%)` : ""}</td></tr>
                  <tr><td style={{ padding: 2 }}>Verified On:</td><td style={{ padding: 2 }}>{report.kyc.reviewed_at ? new Date(report.kyc.reviewed_at).toLocaleDateString() : "—"}</td></tr>
                </tbody>
              </table>
            ) : <p>No KYC data available</p>}

            <h2 style={{ fontSize: 13, borderBottom: "1px solid #ccc", paddingBottom: 4, marginTop: 20 }}>3. TRANSACTION HISTORY ({report.transactions.length} records)</h2>
            <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse", marginBottom: 12 }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ padding: 3, textAlign: "left", border: "1px solid #ddd" }}>Date</th>
                  <th style={{ padding: 3, textAlign: "left", border: "1px solid #ddd" }}>Type</th>
                  <th style={{ padding: 3, textAlign: "right", border: "1px solid #ddd" }}>Amount</th>
                  <th style={{ padding: 3, textAlign: "right", border: "1px solid #ddd" }}>Fee</th>
                  <th style={{ padding: 3, textAlign: "left", border: "1px solid #ddd" }}>Recipient</th>
                  <th style={{ padding: 3, textAlign: "left", border: "1px solid #ddd" }}>Reference</th>
                  <th style={{ padding: 3, textAlign: "left", border: "1px solid #ddd" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.transactions.map((t, i) => (
                  <tr key={i}>
                    <td style={{ padding: 3, border: "1px solid #ddd" }}>{new Date(t.created_at).toLocaleString()}</td>
                    <td style={{ padding: 3, border: "1px solid #ddd" }}>{t.type}</td>
                    <td style={{ padding: 3, border: "1px solid #ddd", textAlign: "right" }}>৳{Number(t.amount).toLocaleString()}</td>
                    <td style={{ padding: 3, border: "1px solid #ddd", textAlign: "right" }}>৳{Number(t.fee || 0).toLocaleString()}</td>
                    <td style={{ padding: 3, border: "1px solid #ddd" }}>{t.recipient || "—"}</td>
                    <td style={{ padding: 3, border: "1px solid #ddd" }}>{t.reference || "—"}</td>
                    <td style={{ padding: 3, border: "1px solid #ddd" }}>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={{ fontSize: 13, borderBottom: "1px solid #ccc", paddingBottom: 4, marginTop: 20 }}>4. REGISTERED DEVICES ({report.devices.length})</h2>
            {report.devices.length > 0 ? (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginBottom: 12 }}>
                <thead><tr style={{ background: "#f0f0f0" }}><th style={{ padding: 3, textAlign: "left", border: "1px solid #ddd" }}>Device Hash</th><th style={{ padding: 3, textAlign: "left", border: "1px solid #ddd" }}>Registered On</th></tr></thead>
                <tbody>{report.devices.map((d, i) => <tr key={i}><td style={{ padding: 3, border: "1px solid #ddd", fontFamily: "monospace" }}>{d.device_fingerprint}</td><td style={{ padding: 3, border: "1px solid #ddd" }}>{new Date(d.created_at).toLocaleString()}</td></tr>)}</tbody>
              </table>
            ) : <p>No device registrations found</p>}

            <h2 style={{ fontSize: 13, borderBottom: "1px solid #ccc", paddingBottom: 4, marginTop: 20 }}>5. ROLES & PERMISSIONS</h2>
            <p style={{ fontSize: 12 }}>{report.roles.length > 0 ? report.roles.map(r => r.role).join(", ") : "No roles assigned"}</p>

            <div style={{ marginTop: 24, borderTop: "2px solid #111", paddingTop: 12, textAlign: "center" }}>
              <table style={{ width: "100%", fontSize: 12, marginBottom: 12 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: 4 }}>Total Transactions: <strong>{report.transactions.length}</strong></td>
                    <td style={{ padding: 4 }}>Total Money In: <strong>৳{totalIn.toLocaleString()}</strong></td>
                    <td style={{ padding: 4 }}>Total Money Out: <strong>৳{totalOut.toLocaleString()}</strong></td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: 10, color: "#888", marginTop: 8 }}>This document is confidential and intended solely for the requesting authority.</p>
              <p style={{ fontSize: 10, color: "#888" }}>Generated by EasyPay Admin System • {new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
