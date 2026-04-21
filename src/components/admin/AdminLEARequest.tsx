import React, { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Download, Shield, FileText, AlertTriangle, User, CreditCard,
  Smartphone, Key, Landmark, ArrowUpDown, Gavel, MessageSquare, Users,
  Briefcase, Store, ClipboardList, Scale, CheckSquare
} from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { generateWalletId } from "@/lib/walletId";

interface UserReport {
  profile: any;
  kyc: any;
  transactions: any[];
  devices: any[];
  roles: any[];
  savedBanks: any[];
  fundRequests: any[];
  loans: any[];
  fraudAlerts: any[];
  disputes: any[];
  complaints: any[];
  referrals: any[];
  agent: any | null;
  merchant: any | null;
  auditLogs: any[];
}

const OPTIONAL_SECTIONS = {
  devices: "Registered Devices",
  savedBanks: "Saved Bank Accounts",
  fundRequests: "Fund Requests",
  loans: "Loan History",
  fraudAlerts: "Fraud Alerts",
  disputes: "Disputes",
  complaints: "Support Complaints",
  referrals: "Referral Activity",
  agent: "Agent Profile",
  merchant: "Merchant Profile",
  auditLogs: "Audit Trail",
} as const;

type SectionKey = keyof typeof OPTIONAL_SECTIONS;

export default function AdminLEARequest() {
  const [phone, setPhone] = useState("");
  const [authority, setAuthority] = useState("");
  const [refNo, setRefNo] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<UserReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [includeSections, setIncludeSections] = useState<Record<SectionKey, boolean>>({
    devices: false,
    savedBanks: false,
    fundRequests: false,
    loans: false,
    fraudAlerts: false,
    disputes: false,
    complaints: false,
    referrals: false,
    agent: false,
    merchant: false,
    auditLogs: false,
  });

  const toggleSection = (key: SectionKey) => setIncludeSections(p => ({ ...p, [key]: !p[key] }));
  const allSelected = Object.values(includeSections).every(Boolean);
  const toggleAll = () => {
    const val = !allSelected;
    setIncludeSections(Object.fromEntries(Object.keys(OPTIONAL_SECTIONS).map(k => [k, val])) as Record<SectionKey, boolean>);
  };

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

      const [
        kycRes, txnRes, devRes, rolesRes,
        banksRes, fundRes, loanRes, fraudRes,
        disputeRes, complaintRes, referralRes,
        agentRes, merchantRes, auditRes
      ] = await Promise.all([
        supabase.from("kyc_verifications").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("device_registrations").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role, created_at").eq("user_id", userId),
        supabase.from("saved_bank_accounts").select("*").eq("user_id", userId),
        supabase.from("fund_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("loan_applications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("fraud_alerts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("disputes").select("*").eq("complainant_id", userId).order("created_at", { ascending: false }),
        supabase.from("support_complaints").select("*").eq("raised_by", userId).order("created_at", { ascending: false }),
        supabase.from("referrals").select("*").or(`referrer_id.eq.${userId},referee_id.eq.${userId}`),
        supabase.from("agents").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("merchants").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("audit_logs").select("*").eq("actor_id", userId).order("created_at", { ascending: false }).limit(100),
      ]);

      setReport({
        profile,
        kyc: kycRes.data,
        transactions: txnRes.data ?? [],
        devices: devRes.data ?? [],
        roles: rolesRes.data ?? [],
        savedBanks: banksRes.data ?? [],
        fundRequests: fundRes.data ?? [],
        loans: loanRes.data ?? [],
        fraudAlerts: fraudRes.data ?? [],
        disputes: disputeRes.data ?? [],
        complaints: complaintRes.data ?? [],
        referrals: referralRes.data ?? [],
        agent: agentRes.data,
        merchant: merchantRes.data,
        auditLogs: auditRes.data ?? [],
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
        scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: imgHeight > 297 ? "portrait" : "portrait" });

      let yOffset = 0;
      const pageHeight = 297;
      while (yOffset < imgHeight) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -yOffset, imgWidth, imgHeight);
        yOffset += pageHeight;
      }

      pdf.save(`LEA-Report-${phone}-${new Date().toISOString().slice(0, 10)}.pdf`);

      await logAction("lea_report_download", {
        phone: phone.trim(),
        user_id: report?.profile?.user_id,
        authority: authority.trim(),
        reference_no: refNo.trim(),
      });

      toast.success("PDF report downloaded");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const walletId = report ? generateWalletId(report.profile.user_id) : "";
  const totalIn = report?.transactions.filter(t => ["receive", "cashin", "addmoney", "deposit"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const totalOut = report?.transactions.filter(t => ["send", "cashout", "payment", "paybill", "recharge", "banktransfer"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const totalFees = report?.transactions.reduce((s, t) => s + Number(t.fee || 0), 0) ?? 0;
  const totalLoansTaken = report?.loans.reduce((s, l) => s + Number(l.amount), 0) ?? 0;
  const totalLoansRepaid = report?.loans.reduce((s, l) => s + Number(l.repaid_amount || 0), 0) ?? 0;
  const accountAgeDays = report ? Math.floor((Date.now() - new Date(report.profile.created_at).getTime()) / 86400000) : 0;

  const SectionTitle = ({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) => (
    <h3 className="text-sm font-semibold flex items-center gap-1 mb-2">
      <Icon className="w-4 h-4" /> {title} {count !== undefined && `(${count})`}
    </h3>
  );

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <><span className="text-muted-foreground">{label}</span><span className="font-medium">{value ?? "—"}</span></>
  );

  // Printable helpers
  const ps = { padding: "4px 6px" } as React.CSSProperties;
  const psw = { padding: "4px 6px", width: 180, color: "#555", fontWeight: "bold" as const } as React.CSSProperties;
  const thS = { padding: "6px 8px", textAlign: "left" as const, border: "1px solid #d0d0d0", background: "#0D9488", color: "#fff", fontWeight: "bold" as const, fontSize: 10 };
  const thR = { ...thS, textAlign: "right" as const };
  const tdS = { padding: "5px 8px", border: "1px solid #e0e0e0", fontSize: 10 };
  const tdR = { ...tdS, textAlign: "right" as const };
  const secH = { fontSize: 13, fontWeight: "bold" as const, borderLeft: "4px solid #0D9488", paddingLeft: 10, paddingBottom: 4, marginTop: 24, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#222" } as React.CSSProperties;

  const PrintTable = ({ headers, rows }: { headers: { label: string; align?: string }[]; rows: React.ReactNode[][] }) => (
    <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse", marginBottom: 14 }}>
      <thead>
        <tr>
          {headers.map((h, i) => <th key={i} style={h.align === "right" ? thR : thS}>{h.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 1 ? "#f9f9f9" : "#fff" }}>
            {r.map((c, j) => <td key={j} style={headers[j]?.align === "right" ? tdR : tdS}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const PrintKV = ({ items }: { items: [string, React.ReactNode][] }) => (
    <table style={{ width: "100%", fontSize: 11, marginBottom: 14, borderCollapse: "collapse" }}>
      <tbody>{items.map(([k, v], i) => (
        <tr key={i} style={{ background: i % 2 === 1 ? "#f9f9f9" : "#fff" }}>
          <td style={{ ...psw, borderBottom: "1px solid #eee" }}>{k}:</td>
          <td style={{ ...ps, borderBottom: "1px solid #eee" }}>{v ?? "—"}</td>
        </tr>
      ))}</tbody>
    </table>
  );

  // Track print section numbering dynamically
  const getPrintSectionNumbers = () => {
    let n = 5; // sections 1-4 are always present, next starts at 5
    const nums: Partial<Record<SectionKey, number>> = {};
    (Object.keys(OPTIONAL_SECTIONS) as SectionKey[]).forEach(k => {
      if (includeSections[k]) { nums[k] = n; n++; }
    });
    return nums;
  };

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
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input placeholder="Requesting Authority *" value={authority} onChange={e => setAuthority(e.target.value)} />
                <Input placeholder="Reference No *" value={refNo} onChange={e => setRefNo(e.target.value)} />
                <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="sm:max-w-[160px]" />
                <Button onClick={handleDownload} disabled={generating} variant="destructive" className="shrink-0">
                  <Download className="w-4 h-4 mr-1" />{generating ? "Generating..." : "Download PDF"}
                </Button>
              </div>

              {/* Optional sections toggle */}
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold flex items-center gap-1"><CheckSquare className="w-3.5 h-3.5" /> Optional Sections to Include</p>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={toggleAll}>
                    {allSelected ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(Object.entries(OPTIONAL_SECTIONS) as [SectionKey, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:bg-muted/40 rounded px-1.5 py-1">
                      <Checkbox checked={includeSections[key]} onCheckedChange={() => toggleSection(key)} className="h-3.5 w-3.5" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* On-screen preview */}
      {report && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* 1. Account Info */}
            <div>
              <SectionTitle icon={User} title="Account Information" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <InfoRow label="Name" value={report.profile.name} />
                <InfoRow label="Phone" value={report.profile.phone} />
                <InfoRow label="Email" value={report.profile.email} />
                <InfoRow label="Wallet ID" value={walletId} />
                <InfoRow label="Status" value={<Badge variant={report.profile.status === "active" ? "default" : "destructive"} className="text-[10px]">{report.profile.status}</Badge>} />
                <InfoRow label="Balance" value={`৳${Number(report.profile.balance || 0).toLocaleString()}`} />
                <InfoRow label="Registered" value={new Date(report.profile.created_at).toLocaleDateString()} />
                <InfoRow label="KYC Exempt" value={report.profile.kyc_exempt ? "Yes" : "No"} />
                <InfoRow label="Account Age" value={`${accountAgeDays} days`} />
              </div>
            </div>
            <Separator />

            {/* 2. KYC */}
            <div>
              <SectionTitle icon={FileText} title="KYC / Identity" />
              {report.kyc ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <InfoRow label="NID Number" value={report.kyc.nid_number} />
                  <InfoRow label="Full Name (NID)" value={report.kyc.full_name} />
                  <InfoRow label="Date of Birth" value={report.kyc.date_of_birth} />
                  <InfoRow label="KYC Status" value={<Badge className="text-[10px]">{report.kyc.status}</Badge>} />
                  <InfoRow label="Face Match" value={`${report.kyc.face_match_result || "—"} ${report.kyc.face_match_score ? `(${report.kyc.face_match_score}%)` : ""}`} />
                  <InfoRow label="Verified On" value={report.kyc.reviewed_at ? new Date(report.kyc.reviewed_at).toLocaleDateString() : null} />
                </div>
              ) : <p className="text-xs text-muted-foreground">No KYC data found</p>}
            </div>
            <Separator />

            {/* 3. Transactions */}
            <div>
              <SectionTitle icon={CreditCard} title="Transactions" count={report.transactions.length} />
              <div className="max-h-60 overflow-auto border rounded text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-1.5 text-left">Date</th><th className="p-1.5 text-left">ID</th><th className="p-1.5 text-left">Type</th>
                      <th className="p-1.5 text-right">Amount</th><th className="p-1.5 text-right">Fee</th><th className="p-1.5 text-right">Bal After</th>
                      <th className="p-1.5 text-left">Recipient</th><th className="p-1.5 text-left">Phone</th><th className="p-1.5 text-left">Ref</th><th className="p-1.5 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.transactions.slice(0, 500).map((t, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1.5 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                        <td className="p-1.5 font-mono text-[10px]">{t.short_id || "—"}</td>
                        <td className="p-1.5">{t.type}</td>
                        <td className="p-1.5 text-right">৳{Number(t.amount).toLocaleString()}</td>
                        <td className="p-1.5 text-right">৳{Number(t.fee || 0).toLocaleString()}</td>
                        <td className="p-1.5 text-right">{t.balance_after != null ? `৳${Number(t.balance_after).toLocaleString()}` : "—"}</td>
                        <td className="p-1.5">{t.recipient_name || "—"}</td>
                        <td className="p-1.5">{t.recipient_phone || "—"}</td>
                        <td className="p-1.5">{t.reference || "—"}</td>
                        <td className="p-1.5">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Separator />

            {/* 4. Roles (always visible) */}
            <div>
              <SectionTitle icon={Key} title="Roles & Permissions" />
              {report.roles.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {report.roles.map((r, i) => <Badge key={i} variant="outline" className="text-[10px]">{r.role}</Badge>)}
                </div>
              ) : <p className="text-xs text-muted-foreground">No roles assigned</p>}
            </div>

            {/* === OPTIONAL SECTIONS === */}

            {includeSections.devices && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={Smartphone} title="Registered Devices" count={report.devices.length} />
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
              </>
            )}

            {includeSections.savedBanks && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={Landmark} title="Saved Bank Accounts" count={report.savedBanks.length} />
                  {report.savedBanks.length > 0 ? (
                    <div className="max-h-40 overflow-auto border rounded text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr><th className="p-1.5 text-left">Bank</th><th className="p-1.5 text-left">Account No</th><th className="p-1.5 text-left">Holder</th><th className="p-1.5 text-left">Added</th></tr>
                        </thead>
                        <tbody>
                          {report.savedBanks.map((b, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1.5">{b.bank_name}</td><td className="p-1.5 font-mono">{b.account_number}</td>
                              <td className="p-1.5">{b.account_holder}</td><td className="p-1.5">{new Date(b.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No saved bank accounts</p>}
                </div>
              </>
            )}

            {includeSections.fundRequests && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={ArrowUpDown} title="Fund Requests" count={report.fundRequests.length} />
                  {report.fundRequests.length > 0 ? (
                    <div className="max-h-40 overflow-auto border rounded text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr><th className="p-1.5 text-left">Date</th><th className="p-1.5 text-left">Type</th><th className="p-1.5 text-right">Amount</th><th className="p-1.5 text-left">Method</th><th className="p-1.5 text-left">Bank</th><th className="p-1.5 text-left">Account</th><th className="p-1.5 text-left">Status</th></tr>
                        </thead>
                        <tbody>
                          {report.fundRequests.map((f, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1.5">{new Date(f.created_at).toLocaleDateString()}</td>
                              <td className="p-1.5">{f.type}</td>
                              <td className="p-1.5 text-right">৳{Number(f.amount).toLocaleString()}</td>
                              <td className="p-1.5">{f.source_method || "—"}</td>
                              <td className="p-1.5">{f.bank_name || "—"}</td>
                              <td className="p-1.5 font-mono">{f.account_number || "—"}</td>
                              <td className="p-1.5"><Badge variant="outline" className="text-[10px]">{f.status}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No fund requests</p>}
                </div>
              </>
            )}

            {includeSections.loans && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={Scale} title="Loan History" count={report.loans.length} />
                  {report.loans.length > 0 ? (
                    <div className="max-h-40 overflow-auto border rounded text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr><th className="p-1.5 text-left">Applied</th><th className="p-1.5 text-right">Amount</th><th className="p-1.5 text-left">Tenure</th><th className="p-1.5 text-right">Repaid</th><th className="p-1.5 text-left">Status</th></tr>
                        </thead>
                        <tbody>
                          {report.loans.map((l, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1.5">{new Date(l.applied_at).toLocaleDateString()}</td>
                              <td className="p-1.5 text-right">৳{Number(l.amount).toLocaleString()}</td>
                              <td className="p-1.5">{l.tenure_days} days</td>
                              <td className="p-1.5 text-right">৳{Number(l.repaid_amount || 0).toLocaleString()}</td>
                              <td className="p-1.5"><Badge variant="outline" className="text-[10px]">{l.status}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No loan history</p>}
                </div>
              </>
            )}

            {includeSections.fraudAlerts && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={AlertTriangle} title="Fraud Alerts" count={report.fraudAlerts.length} />
                  {report.fraudAlerts.length > 0 ? (
                    <div className="max-h-40 overflow-auto border rounded text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr><th className="p-1.5 text-left">Date</th><th className="p-1.5 text-left">Rule</th><th className="p-1.5 text-left">Severity</th><th className="p-1.5 text-left">Status</th></tr>
                        </thead>
                        <tbody>
                          {report.fraudAlerts.map((f, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1.5">{new Date(f.created_at).toLocaleDateString()}</td>
                              <td className="p-1.5">{f.rule_triggered}</td>
                              <td className="p-1.5"><Badge variant={f.severity === "critical" ? "destructive" : "outline"} className="text-[10px]">{f.severity}</Badge></td>
                              <td className="p-1.5">{f.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No fraud alerts</p>}
                </div>
              </>
            )}

            {includeSections.disputes && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={Gavel} title="Disputes" count={report.disputes.length} />
                  {report.disputes.length > 0 ? (
                    <div className="max-h-40 overflow-auto border rounded text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr><th className="p-1.5 text-left">Date</th><th className="p-1.5 text-left">Subject</th><th className="p-1.5 text-left">Status</th><th className="p-1.5 text-left">Resolution</th></tr>
                        </thead>
                        <tbody>
                          {report.disputes.map((d, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1.5">{new Date(d.created_at).toLocaleDateString()}</td>
                              <td className="p-1.5">{d.subject}</td>
                              <td className="p-1.5"><Badge variant="outline" className="text-[10px]">{d.status}</Badge></td>
                              <td className="p-1.5 max-w-[200px] truncate">{d.resolution_notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No disputes</p>}
                </div>
              </>
            )}

            {includeSections.complaints && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={MessageSquare} title="Support Complaints" count={report.complaints.length} />
                  {report.complaints.length > 0 ? (
                    <div className="max-h-40 overflow-auto border rounded text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr><th className="p-1.5 text-left">Ticket</th><th className="p-1.5 text-left">Subject</th><th className="p-1.5 text-left">Priority</th><th className="p-1.5 text-left">Status</th></tr>
                        </thead>
                        <tbody>
                          {report.complaints.map((c, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1.5 font-mono">{c.complaint_number}</td>
                              <td className="p-1.5">{c.subject}</td>
                              <td className="p-1.5"><Badge variant="outline" className="text-[10px]">{c.priority}</Badge></td>
                              <td className="p-1.5">{c.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No support complaints</p>}
                </div>
              </>
            )}

            {includeSections.referrals && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={Users} title="Referral Activity" count={report.referrals.length} />
                  {report.referrals.length > 0 ? (
                    <div className="max-h-40 overflow-auto border rounded text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr><th className="p-1.5 text-left">Date</th><th className="p-1.5 text-left">Wallet ID</th><th className="p-1.5 text-left">Role</th><th className="p-1.5 text-right">Rewarded</th><th className="p-1.5 text-left">Status</th></tr>
                        </thead>
                        <tbody>
                          {report.referrals.map((r, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1.5">{new Date(r.created_at).toLocaleDateString()}</td>
                              <td className="p-1.5 font-mono">{r.referrer_id === report.profile.user_id ? generateWalletId(r.referee_id) : generateWalletId(r.referrer_id)}</td>
                              <td className="p-1.5">{r.referrer_id === report.profile.user_id ? "Referrer" : "Referee"}</td>
                              <td className="p-1.5 text-right">৳{Number(r.total_rewarded || 0).toLocaleString()}</td>
                              <td className="p-1.5">{r.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No referral activity</p>}
                </div>
              </>
            )}

            {includeSections.agent && report.agent && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={Briefcase} title="Agent Profile" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <InfoRow label="Business Name" value={report.agent.business_name} />
                    <InfoRow label="NID" value={report.agent.nid_number} />
                    <InfoRow label="Trade License" value={report.agent.trade_license} />
                    <InfoRow label="Territory" value={report.agent.territory_code} />
                    <InfoRow label="Status" value={report.agent.status} />
                    <InfoRow label="Commission Earned" value={`৳${Number(report.agent.commission_earned || 0).toLocaleString()}`} />
                    <InfoRow label="Max Float" value={`৳${Number(report.agent.max_float || 0).toLocaleString()}`} />
                    <InfoRow label="Activated" value={report.agent.activated_at ? new Date(report.agent.activated_at).toLocaleDateString() : null} />
                  </div>
                </div>
              </>
            )}

            {includeSections.merchant && report.merchant && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={Store} title="Merchant Profile" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <InfoRow label="Business Name" value={report.merchant.business_name} />
                    <InfoRow label="Category" value={report.merchant.category} />
                    <InfoRow label="Trade License" value={report.merchant.trade_license} />
                    <InfoRow label="Bank Name" value={report.merchant.bank_name} />
                    <InfoRow label="Bank Account" value={report.merchant.bank_account_number} />
                    <InfoRow label="Bank Holder" value={report.merchant.bank_account_holder} />
                    <InfoRow label="Status" value={report.merchant.status} />
                    <InfoRow label="MDR Rate" value={report.merchant.mdr_rate ? `${report.merchant.mdr_rate}%` : null} />
                  </div>
                </div>
              </>
            )}

            {includeSections.auditLogs && (
              <>
                <Separator />
                <div>
                  <SectionTitle icon={ClipboardList} title="Audit Trail (Last 100)" count={report.auditLogs.length} />
                  {report.auditLogs.length > 0 ? (
                    <div className="max-h-40 overflow-auto border rounded text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr><th className="p-1.5 text-left">Date</th><th className="p-1.5 text-left">Action</th><th className="p-1.5 text-left">Entity</th><th className="p-1.5 text-left">IP</th></tr>
                        </thead>
                        <tbody>
                          {report.auditLogs.map((a, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1.5 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                              <td className="p-1.5">{a.action}</td>
                              <td className="p-1.5">{a.entity_type || "—"}</td>
                              <td className="p-1.5 font-mono text-[10px]">{a.ip_address || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No audit logs</p>}
                </div>
              </>
            )}

            {/* Summary */}
            <Separator />
            <div className="bg-muted/30 p-3 rounded-lg text-xs">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
                <div><p className="text-muted-foreground">Total Txns</p><p className="font-bold text-sm">{report.transactions.length}</p></div>
                <div><p className="text-muted-foreground">Total In</p><p className="font-bold text-sm text-emerald-600">৳{totalIn.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Total Out</p><p className="font-bold text-sm text-red-600">৳{totalOut.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Total Fees</p><p className="font-bold text-sm">৳{totalFees.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Loans Taken</p><p className="font-bold text-sm">৳{totalLoansTaken.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Loans Repaid</p><p className="font-bold text-sm">৳{totalLoansRepaid.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Fraud Alerts</p><p className="font-bold text-sm">{report.fraudAlerts.length}</p></div>
                <div><p className="text-muted-foreground">Disputes</p><p className="font-bold text-sm">{report.disputes.length}</p></div>
                <div><p className="text-muted-foreground">Account Age</p><p className="font-bold text-sm">{accountAgeDays}d</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden printable report for html2canvas */}
      {report && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <div ref={reportRef} style={{ width: 900, padding: 40, background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 12 }}>
            {/* Branded Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, paddingBottom: 12, borderBottom: "3px solid #0D9488" }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: "bold", letterSpacing: 1, color: "#0D9488", margin: 0 }}>EasyPay</h1>
                <p style={{ fontSize: 9, color: "#666", margin: "2px 0 0" }}>Digital Financial Services • Bangladesh</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 14, fontWeight: "bold", margin: 0, letterSpacing: 1 }}>USER DATA DISCLOSURE REPORT</p>
                <p style={{ fontSize: 10, color: "#c00", margin: "2px 0 0", fontWeight: "bold" }}>CONFIDENTIAL — LAW ENFORCEMENT ONLY</p>
              </div>
            </div>

            <table style={{ width: "100%", marginBottom: 16, fontSize: 12 }}>
              <tbody>
                <tr><td style={psw}>Report ID:</td><td style={{ ...ps, fontWeight: "bold" }}>{generateReportId()}</td></tr>
                <tr><td style={psw}>Issue Date:</td><td style={{ ...ps, fontWeight: "bold" }}>{issueDate ? new Date(issueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "_______________"}</td></tr>
                <tr><td style={psw}>Generated At:</td><td style={ps}>{new Date().toLocaleString()}</td></tr>
                <tr><td style={psw}>Requesting Authority:</td><td style={{ ...ps, fontWeight: "bold" }}>{authority || "_______________"}</td></tr>
                <tr><td style={psw}>Reference No:</td><td style={{ ...ps, fontWeight: "bold" }}>{refNo || "_______________"}</td></tr>
              </tbody>
            </table>

            {/* 1. Account */}
            <h2 style={secH}>1. ACCOUNT INFORMATION</h2>
            <PrintKV items={[
              ["Name", report.profile.name || "—"],
              ["Phone", report.profile.phone],
              ["Email", report.profile.email || "—"],
              ["Wallet ID", walletId],
              ["Account Status", report.profile.status],
              ["Current Balance", `৳${Number(report.profile.balance || 0).toLocaleString()}`],
              ["Registration Date", new Date(report.profile.created_at).toLocaleDateString()],
              ["KYC Exempt", report.profile.kyc_exempt ? "Yes" : "No"],
              ["Deactivated At", report.profile.deactivated_at ? new Date(report.profile.deactivated_at).toLocaleString() : "—"],
              ["Scheduled Deletion", report.profile.scheduled_deletion_at ? new Date(report.profile.scheduled_deletion_at).toLocaleString() : "—"],
              ["Account Age", `${accountAgeDays} days`],
            ]} />

            {/* 2. KYC */}
            <h2 style={secH}>2. KYC / IDENTITY</h2>
            {report.kyc ? (
              <PrintKV items={[
                ["NID Number", report.kyc.nid_number || "—"],
                ["Full Name (NID)", report.kyc.full_name || "—"],
                ["Date of Birth", report.kyc.date_of_birth || "—"],
                ["KYC Status", report.kyc.status],
                ["Face Match", `${report.kyc.face_match_result || "—"} ${report.kyc.face_match_score ? `(${report.kyc.face_match_score}%)` : ""}`],
                ["Verified On", report.kyc.reviewed_at ? new Date(report.kyc.reviewed_at).toLocaleDateString() : "—"],
              ]} />
            ) : <p>No KYC data available</p>}

            {/* 3. Transactions */}
            <h2 style={secH}>3. TRANSACTION HISTORY ({report.transactions.length} records)</h2>
            <PrintTable
              headers={[
                { label: "Date" }, { label: "ID" }, { label: "Type" },
                { label: "Amount", align: "right" }, { label: "Fee", align: "right" }, { label: "Bal After", align: "right" },
                { label: "Recipient" }, { label: "Phone" }, { label: "Ref" }, { label: "Status" },
              ]}
              rows={report.transactions.map(t => [
                new Date(t.created_at).toLocaleString(), t.short_id || "—", t.type,
                `৳${Number(t.amount).toLocaleString()}`, `৳${Number(t.fee || 0).toLocaleString()}`,
                t.balance_after != null ? `৳${Number(t.balance_after).toLocaleString()}` : "—",
                t.recipient_name || "—", t.recipient_phone || "—", t.reference || "—", t.status,
              ])}
            />

            {/* 4. Roles */}
            <h2 style={secH}>4. ROLES & PERMISSIONS</h2>
            <p style={{ fontSize: 12 }}>{report.roles.length > 0 ? report.roles.map(r => r.role).join(", ") : "No roles assigned"}</p>

            {/* Optional print sections with dynamic numbering */}
            {(() => {
              const nums = getPrintSectionNumbers();
              return (
                <>
                  {includeSections.devices && (
                    <>
                      <h2 style={secH}>{nums.devices}. REGISTERED DEVICES ({report.devices.length})</h2>
                      {report.devices.length > 0 ? (
                        <PrintTable headers={[{ label: "Device Hash" }, { label: "Registered On" }]}
                          rows={report.devices.map(d => [d.device_fingerprint, new Date(d.created_at).toLocaleString()])} />
                      ) : <p>No device registrations found</p>}
                    </>
                  )}

                  {includeSections.savedBanks && (
                    <>
                      <h2 style={secH}>{nums.savedBanks}. SAVED BANK ACCOUNTS ({report.savedBanks.length})</h2>
                      {report.savedBanks.length > 0 ? (
                        <PrintTable headers={[{ label: "Bank" }, { label: "Account No" }, { label: "Holder" }, { label: "Added" }]}
                          rows={report.savedBanks.map(b => [b.bank_name, b.account_number, b.account_holder, new Date(b.created_at).toLocaleDateString()])} />
                      ) : <p>No saved bank accounts</p>}
                    </>
                  )}

                  {includeSections.fundRequests && (
                    <>
                      <h2 style={secH}>{nums.fundRequests}. FUND REQUESTS ({report.fundRequests.length})</h2>
                      {report.fundRequests.length > 0 ? (
                        <PrintTable
                          headers={[{ label: "Date" }, { label: "Type" }, { label: "Amount", align: "right" }, { label: "Method" }, { label: "Bank" }, { label: "Account" }, { label: "Status" }]}
                          rows={report.fundRequests.map(f => [
                            new Date(f.created_at).toLocaleDateString(), f.type, `৳${Number(f.amount).toLocaleString()}`,
                            f.source_method || "—", f.bank_name || "—", f.account_number || "—", f.status,
                          ])}
                        />
                      ) : <p>No fund requests</p>}
                    </>
                  )}

                  {includeSections.loans && (
                    <>
                      <h2 style={secH}>{nums.loans}. LOAN HISTORY ({report.loans.length})</h2>
                      {report.loans.length > 0 ? (
                        <PrintTable
                          headers={[{ label: "Applied" }, { label: "Amount", align: "right" }, { label: "Tenure" }, { label: "Repaid", align: "right" }, { label: "Status" }]}
                          rows={report.loans.map(l => [
                            new Date(l.applied_at).toLocaleDateString(), `৳${Number(l.amount).toLocaleString()}`,
                            `${l.tenure_days} days`, `৳${Number(l.repaid_amount || 0).toLocaleString()}`, l.status,
                          ])}
                        />
                      ) : <p>No loan history</p>}
                    </>
                  )}

                  {includeSections.fraudAlerts && (
                    <>
                      <h2 style={secH}>{nums.fraudAlerts}. FRAUD ALERTS ({report.fraudAlerts.length})</h2>
                      {report.fraudAlerts.length > 0 ? (
                        <PrintTable
                          headers={[{ label: "Date" }, { label: "Rule Triggered" }, { label: "Severity" }, { label: "Status" }]}
                          rows={report.fraudAlerts.map(f => [new Date(f.created_at).toLocaleDateString(), f.rule_triggered, f.severity, f.status])}
                        />
                      ) : <p>No fraud alerts</p>}
                    </>
                  )}

                  {includeSections.disputes && (
                    <>
                      <h2 style={secH}>{nums.disputes}. DISPUTES ({report.disputes.length})</h2>
                      {report.disputes.length > 0 ? (
                        <PrintTable
                          headers={[{ label: "Date" }, { label: "Subject" }, { label: "Status" }, { label: "Resolution" }]}
                          rows={report.disputes.map(d => [new Date(d.created_at).toLocaleDateString(), d.subject, d.status, d.resolution_notes || "—"])}
                        />
                      ) : <p>No disputes</p>}
                    </>
                  )}

                  {includeSections.complaints && (
                    <>
                      <h2 style={secH}>{nums.complaints}. SUPPORT COMPLAINTS ({report.complaints.length})</h2>
                      {report.complaints.length > 0 ? (
                        <PrintTable
                          headers={[{ label: "Ticket #" }, { label: "Subject" }, { label: "Priority" }, { label: "Status" }]}
                          rows={report.complaints.map(c => [c.complaint_number, c.subject, c.priority, c.status])}
                        />
                      ) : <p>No support complaints</p>}
                    </>
                  )}

                  {includeSections.referrals && (
                    <>
                      <h2 style={secH}>{nums.referrals}. REFERRAL ACTIVITY ({report.referrals.length})</h2>
                      {report.referrals.length > 0 ? (
                        <PrintTable
                          headers={[{ label: "Date" }, { label: "Wallet ID" }, { label: "Role" }, { label: "Rewarded", align: "right" }, { label: "Status" }]}
                          rows={report.referrals.map(r => [
                            new Date(r.created_at).toLocaleDateString(),
                            r.referrer_id === report.profile.user_id ? generateWalletId(r.referee_id) : generateWalletId(r.referrer_id),
                            r.referrer_id === report.profile.user_id ? "Referrer" : "Referee",
                            `৳${Number(r.total_rewarded || 0).toLocaleString()}`, r.status,
                          ])}
                        />
                      ) : <p>No referral activity</p>}
                    </>
                  )}

                  {includeSections.agent && report.agent && (
                    <>
                      <h2 style={secH}>{nums.agent}. AGENT PROFILE</h2>
                      <PrintKV items={[
                        ["Business Name", report.agent.business_name || "—"],
                        ["NID", report.agent.nid_number || "—"],
                        ["Trade License", report.agent.trade_license || "—"],
                        ["Territory", report.agent.territory_code || "—"],
                        ["Status", report.agent.status],
                        ["Commission Earned", `৳${Number(report.agent.commission_earned || 0).toLocaleString()}`],
                        ["Max Float", `৳${Number(report.agent.max_float || 0).toLocaleString()}`],
                        ["Activated", report.agent.activated_at ? new Date(report.agent.activated_at).toLocaleDateString() : "—"],
                      ]} />
                    </>
                  )}

                  {includeSections.merchant && report.merchant && (
                    <>
                      <h2 style={secH}>{nums.merchant}. MERCHANT PROFILE</h2>
                      <PrintKV items={[
                        ["Business Name", report.merchant.business_name || "—"],
                        ["Category", report.merchant.category || "—"],
                        ["Trade License", report.merchant.trade_license || "—"],
                        ["Bank Name", report.merchant.bank_name || "—"],
                        ["Bank Account", report.merchant.bank_account_number || "—"],
                        ["Bank Holder", report.merchant.bank_account_holder || "—"],
                        ["Status", report.merchant.status],
                        ["MDR Rate", report.merchant.mdr_rate ? `${report.merchant.mdr_rate}%` : "—"],
                      ]} />
                    </>
                  )}

                  {includeSections.auditLogs && (
                    <>
                      <h2 style={secH}>{nums.auditLogs}. AUDIT TRAIL (Last {report.auditLogs.length} entries)</h2>
                      {report.auditLogs.length > 0 ? (
                        <PrintTable
                          headers={[{ label: "Date" }, { label: "Action" }, { label: "Entity" }, { label: "IP Address" }]}
                          rows={report.auditLogs.map(a => [new Date(a.created_at).toLocaleString(), a.action, a.entity_type || "—", a.ip_address || "—"])}
                        />
                      ) : <p>No audit logs</p>}
                    </>
                  )}
                </>
              );
            })()}

            {/* Summary Footer */}
            <div style={{ marginTop: 24, borderTop: "2px solid #111", paddingTop: 12 }}>
              <table style={{ width: "100%", fontSize: 12, marginBottom: 12 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: 4 }}>Total Transactions: <strong>{report.transactions.length}</strong></td>
                    <td style={{ padding: 4 }}>Total Money In: <strong>৳{totalIn.toLocaleString()}</strong></td>
                    <td style={{ padding: 4 }}>Total Money Out: <strong>৳{totalOut.toLocaleString()}</strong></td>
                  </tr>
                  <tr>
                    <td style={{ padding: 4 }}>Total Fees Paid: <strong>৳{totalFees.toLocaleString()}</strong></td>
                    <td style={{ padding: 4 }}>Loans Taken: <strong>৳{totalLoansTaken.toLocaleString()}</strong></td>
                    <td style={{ padding: 4 }}>Loans Repaid: <strong>৳{totalLoansRepaid.toLocaleString()}</strong></td>
                  </tr>
                  <tr>
                    <td style={{ padding: 4 }}>Fraud Alerts: <strong>{report.fraudAlerts.length}</strong></td>
                    <td style={{ padding: 4 }}>Disputes: <strong>{report.disputes.length}</strong></td>
                    <td style={{ padding: 4 }}>Account Age: <strong>{accountAgeDays} days</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Authority Signature & Certification */}
            <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #ccc" }}>
              <p style={{ fontSize: 11, fontWeight: "bold", marginBottom: 16 }}>CERTIFICATION & AUTHORITY SIGN-OFF</p>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 40 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Issuing Officer (EasyPay)</p>
                  <div style={{ borderBottom: "1px solid #333", height: 40, marginBottom: 4 }} />
                  <p style={{ fontSize: 9, color: "#888" }}>Name & Designation</p>
                  <p style={{ fontSize: 9, color: "#888", marginTop: 2 }}>Date: {issueDate ? new Date(issueDate + "T00:00:00").toLocaleDateString("en-GB") : "____/____/________"}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Receiving Authority</p>
                  <div style={{ borderBottom: "1px solid #333", height: 40, marginBottom: 4 }} />
                  <p style={{ fontSize: 9, color: "#888" }}>Name, Rank & Badge No.</p>
                  <p style={{ fontSize: 9, color: "#888", marginTop: 2 }}>Authority: {authority || "_______________"}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Official Seal / Stamp</p>
                  <div style={{ border: "1px dashed #aaa", height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, color: "#bbb" }}>[Seal]</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Branded Footer */}
            <div style={{ marginTop: 30, paddingTop: 12, borderTop: "3px solid #0D9488", textAlign: "center" }}>
              <p style={{ fontSize: 11, fontWeight: "bold", color: "#0D9488", margin: 0 }}>EasyPay — Digital Financial Services</p>
              <p style={{ fontSize: 9, color: "#888", marginTop: 2 }}>Dhaka, Bangladesh • support@easypay.app • www.easypay.app</p>
              <p style={{ fontSize: 9, color: "#aaa", marginTop: 6 }}>This document is confidential and intended solely for the requesting law enforcement authority.</p>
              <p style={{ fontSize: 9, color: "#aaa" }}>Unauthorized disclosure, reproduction, or distribution is strictly prohibited.</p>
              <p style={{ fontSize: 8, color: "#bbb", marginTop: 4 }}>Generated by EasyPay Admin System • {new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
