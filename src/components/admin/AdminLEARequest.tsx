import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, Download, Shield, FileText, AlertTriangle, User, CreditCard,
  Smartphone, Key, Landmark, ArrowUpDown, Gavel, MessageSquare, Users,
  Briefcase, Store, ClipboardList, Scale, CheckSquare, History, Eye, X, Loader2,
  CheckCircle2, AlertCircle
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
  const [reportId, setReportId] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ authority: false, refNo: false, issueDate: false });
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [adminCache, setAdminCache] = useState<Record<string, { name: string; phone: string }>>({});
  const [reDownloadingId, setReDownloadingId] = useState<string | null>(null);
  const [redownloadPhase, setRedownloadPhase] = useState<"idle" | "loading" | "preparing" | "downloading">("idle");
  const [historyFilter, setHistoryFilter] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [paginationResult, setPaginationResult] = useState<{ mode: "measured" | "fallback"; pages: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"download" | "redownload">("download");
  const reportRef = useRef<HTMLDivElement>(null);
  const pendingRedownloadIdRef = useRef<string | null>(null);
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

  const generateReportId = () => {
    const d = new Date();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LEA-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${rand}`;
  };

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from("lea_reports")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(50);
      setHistory(data ?? []);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const adminCacheRef = useRef<Record<string, { name: string; phone: string }>>({});

  const fetchAdminProfile = useCallback(async (adminId: string) => {
    if (adminCacheRef.current[adminId]) {
      setAdminCache(prev => ({ ...prev, [adminId]: adminCacheRef.current[adminId] }));
      return adminCacheRef.current[adminId];
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("name, phone")
        .eq("user_id", adminId)
        .maybeSingle();
      const info = { name: data?.name || "Unknown Admin", phone: data?.phone || "—" };
      adminCacheRef.current[adminId] = info;
      setAdminCache(prev => ({ ...prev, [adminId]: info }));
      return info;
    } catch {
      const fallback = { name: "Unknown", phone: "—" };
      setAdminCache(prev => ({ ...prev, [adminId]: fallback }));
      return fallback;
    }
  }, []);

  const handleSelectHistory = async (id: string) => {
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
      return;
    }
    setSelectedHistoryId(id);
    const row = history.find(h => h.id === id);
    if (row) await fetchAdminProfile(row.generated_by);
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

  const handleSearch = async (overrides?: { phone?: string; reportId?: string }) => {
    const searchPhone = (overrides?.phone ?? phone).trim();
    if (!searchPhone) {
      toast.error("Enter a phone number");
      return false;
    }
    setLoading(true);
    setReport(null);
    setReportId(overrides?.reportId ?? "");

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("phone", searchPhone)
        .maybeSingle();

      if (error) throw error;
      if (!profile) {
        toast.error("No user found with this number");
        setLoading(false);
        return false;
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

      setReportId(overrides?.reportId ?? generateReportId());

      await logAction("lea_data_search", { phone: searchPhone, user_id: userId });
      toast.success("User data retrieved");
      return true;
    } catch (err: any) {
      toast.error(err.message || "Search failed");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const hasValidationErrors = !authority.trim() || !refNo.trim() || !issueDate;
  const enabledSections = (Object.keys(OPTIONAL_SECTIONS) as SectionKey[]).filter(k => includeSections[k]);
  const readinessItems = [
    { label: "Phone searched", ready: !!phone.trim() },
    { label: "User profile found", ready: !!report?.profile },
    { label: "Requesting authority filled", ready: !!authority.trim() },
    { label: "Reference number filled", ready: !!refNo.trim() },
    { label: "Issue date selected", ready: !!issueDate },
    { label: "Report ID generated", ready: !!reportId },
    { label: "Transaction data loaded", ready: !!report },
    { label: "Optional sections selected", ready: enabledSections.length > 0 },
  ];

  const filteredHistory = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    if (!q) return history;
    return history.filter(h => [h.phone, h.report_id, h.authority, h.reference_no]
      .some(value => String(value ?? "").toLowerCase().includes(q)));
  }, [history, historyFilter]);

  const getRedownloadLabel = (id: string) => {
    if (reDownloadingId !== id) return "Re-download";
    if (redownloadPhase === "loading") return "Loading data...";
    if (redownloadPhase === "preparing") return "Preparing PDF...";
    if (redownloadPhase === "downloading") return "Downloading...";
    return "Preparing...";
  };

  const validatePdfFields = () => {
    const errors = {
      authority: !authority.trim(),
      refNo: !refNo.trim(),
      issueDate: !issueDate,
    };
    setFieldErrors(errors);
    if (errors.authority || errors.refNo || errors.issueDate) {
      toast.error("Please fill all required fields before downloading");
      return false;
    }
    return true;
  };

  const openPdfConfirmation = (mode: "download" | "redownload") => {
    if (!validatePdfFields()) return;
    setConfirmMode(mode);
    setConfirmOpen(true);
  };

  const handleDownload = async () => {
    if (!validatePdfFields()) return false;
    if (!reportRef.current) return false;

    setGenerating(true);
    if (reDownloadingId) setRedownloadPhase("preparing");
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false,
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      const pageHeight = 297;
      const minSegmentHeightPx = Math.max(80, Math.floor(canvas.height * 0.015));
      const rootRect = reportRef.current.getBoundingClientRect();
      const canvasPxPerDomPx = canvas.height / rootRect.height;
      const pageHeightPx = pageHeight * (canvas.height / imgHeight);
      const mmPerDomPx = imgHeight / rootRect.height;
      const rowBounds = Array.from(reportRef.current.querySelectorAll<HTMLElement>('[data-lea-paginate-row="true"]')).map(row => {
        const rect = row.getBoundingClientRect();
        return {
          top: Math.round((rect.top - rootRect.top) * canvasPxPerDomPx),
          bottom: Math.round((rect.bottom - rootRect.top) * canvasPxPerDomPx),
          height: Math.round(rect.height * canvasPxPerDomPx),
        };
      }).filter(row => row.bottom > row.top);
      const rowBreaks = Array.from(new Set(rowBounds.flatMap(row => [row.top, row.bottom]))).sort((a, b) => a - b);
      const measuredSegments: { startPx: number; endPx: number }[] = [];
      let yOffset = 0;
      while (yOffset < canvas.height) {
        const targetBreak = Math.min(yOffset + pageHeightPx, canvas.height);
        const rowCrossingBreak = rowBounds.find(row => row.top < targetBreak && row.bottom > targetBreak);
        const validRowBreak = rowBreaks.filter(point => point > yOffset && point <= targetBreak).at(-1);
        let nextBreak = rowCrossingBreak && validRowBreak ? validRowBreak : targetBreak;
        const tallestRowOnPage = rowBounds.find(row => row.top <= yOffset && row.bottom > targetBreak);
        if (tallestRowOnPage) nextBreak = targetBreak;
        if (nextBreak <= yOffset) nextBreak = Math.min(yOffset + pageHeightPx, canvas.height);
        measuredSegments.push({ startPx: Math.floor(yOffset), endPx: Math.floor(nextBreak) });
        yOffset = nextBreak;
      }

      const isContinuous = (items: { startPx: number; endPx: number }[]) => {
        if (!items.length || items[0].startPx !== 0 || items.at(-1)?.endPx !== canvas.height) return false;
        return items.every((segment, index) => {
          const previous = items[index - 1];
          const hasValidBounds = segment.startPx >= 0 && segment.endPx > segment.startPx && segment.endPx <= canvas.height;
          return hasValidBounds && (index === 0 || segment.startPx === previous.endPx);
        });
      };

      const buildMmFallbackSegments = () => {
        const safeRows = Array.from(reportRef.current!.querySelectorAll<HTMLElement>('[data-lea-paginate-row="true"]')).map(row => {
          const rect = row.getBoundingClientRect();
          return { top: (rect.top - rootRect.top) * mmPerDomPx, bottom: (rect.bottom - rootRect.top) * mmPerDomPx };
        });
        const fallback: { startPx: number; endPx: number }[] = [];
        let mmOffset = 0;
        while (mmOffset < imgHeight - 0.5) {
          let nextBreak = Math.min(mmOffset + pageHeight, imgHeight);
          const splitRow = safeRows.find(row => row.top > mmOffset + 8 && row.top < nextBreak && row.bottom > nextBreak - 1);
          if (splitRow && splitRow.top - mmOffset > 35) nextBreak = Math.max(mmOffset + 1, splitRow.top - 1);
          fallback.push({
            startPx: Math.floor(mmOffset * (canvas.height / imgHeight)),
            endPx: Math.min(canvas.height, Math.floor(nextBreak * (canvas.height / imgHeight))),
          });
          mmOffset = nextBreak;
        }
        if (fallback.length) {
          fallback[0].startPx = 0;
          fallback[fallback.length - 1].endPx = canvas.height;
          for (let i = 1; i < fallback.length; i++) fallback[i].startPx = fallback[i - 1].endPx;
        }
        return fallback;
      };

      const measurementsConsistent = Number.isFinite(canvasPxPerDomPx) && Number.isFinite(pageHeightPx) && rootRect.height > 0 && rowBounds.every(row => row.height > 0 && row.top >= 0 && row.bottom <= canvas.height + 2);
      const mergeTinyTrailingSegment = (items: { startPx: number; endPx: number }[]) => {
        if (items.length > 1) {
          const last = items[items.length - 1];
          if (last.endPx - last.startPx < minSegmentHeightPx) {
            items[items.length - 2].endPx = last.endPx;
            items.pop();
          }
        }
        return items.filter(segment => segment.endPx - segment.startPx >= 1);
      };
      const useMeasured = measurementsConsistent && isContinuous(measuredSegments);
      const segments = mergeTinyTrailingSegment(useMeasured ? measuredSegments : buildMmFallbackSegments());
      const paginationMode = useMeasured ? "measured" : "fallback";
      setPaginationResult({ mode: paginationMode, pages: Math.max(segments.length, 1) });

      segments.forEach((segment, index) => {
        const sourceY = segment.startPx;
        const sourceHeight = Math.min(canvas.height - sourceY, segment.endPx - segment.startPx);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const context = pageCanvas.getContext("2d");
        context?.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
        if (index > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 0, 0, imgWidth, sourceHeight * (imgHeight / canvas.height));
      });

      if (segments.length === 0) {
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
      }

      const pageCount = pdf.getNumberOfPages();
      const footerGeneratedAt = new Date().toISOString();
      const footerAdmin = "EasyPay Admin";
      for (let page = 1; page <= pageCount; page++) {
        pdf.setPage(page);
        pdf.setFontSize(7);
        pdf.setTextColor(110);
        pdf.text(
          `Report ID: ${reportId} | Generated: ${footerGeneratedAt} | Phone: ${phone.trim()} | Ref: ${refNo.trim()} | Sections: ${enabledSections.length} | ${paginationMode}`,
          8,
          292,
          { maxWidth: 160 },
        );
        pdf.text(`Page ${page} of ${pageCount}`, 190, 292, { align: "right" });
        pdf.text(`Generated by: ${footerAdmin}`, 8, 295);
      }

      if (reDownloadingId) setRedownloadPhase("downloading");
      pdf.save(`LEA-Report-${phone}-${new Date().toISOString().slice(0, 10)}.pdf`);

      // Save to database
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("lea_reports").insert({
          report_id: reportId,
          phone: phone.trim(),
          target_user_id: report?.profile?.user_id || null,
          authority: authority.trim(),
          reference_no: refNo.trim(),
          issue_date: issueDate,
          sections_included: enabledSections,
          generated_by: session.user.id,
          summary: {
            total_txns: report?.transactions.length ?? 0,
            total_in: totalIn,
            total_out: totalOut,
            fraud_alerts: report?.fraudAlerts.length ?? 0,
            disputes: report?.disputes.length ?? 0,
            internal_note: internalNote.trim() || null,
            pagination_mode: paginationMode,
            page_count: pageCount,
          },
        } as any);
      }

      await logAction("lea_report_download", {
        phone: phone.trim(),
        user_id: report?.profile?.user_id,
        authority: authority.trim(),
        reference_no: refNo.trim(),
        report_id: reportId,
      });

      toast.success("PDF report downloaded");
      fetchHistory();
      return true;
    } catch {
      toast.error("Failed to generate report");
      return false;
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!report || !reDownloadingId || loading || generating || pendingRedownloadIdRef.current !== reDownloadingId) return;
    pendingRedownloadIdRef.current = null;
    setConfirmMode("redownload");
    setConfirmOpen(true);
  }, [report, reDownloadingId, loading, generating]);

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

  const PrintTable = ({ headers, rows, colWidths, fontSize }: { headers: { label: string; align?: string }[]; rows: React.ReactNode[][]; colWidths?: string[]; fontSize?: number }) => (
    <table style={{ width: "100%", fontSize: fontSize ?? 10, borderCollapse: "collapse", marginBottom: 14, tableLayout: colWidths ? "fixed" : "auto" }}>
      {colWidths && (
        <colgroup>
          {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
      )}
      <thead>
        <tr>
          {headers.map((h, i) => <th key={i} style={h.align === "right" ? thR : thS}>{h.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} data-lea-paginate-row="true" style={{ background: i % 2 === 1 ? "#f9f9f9" : "#fff" }}>
            {r.map((c, j) => <td key={j} style={{ ...(headers[j]?.align === "right" ? tdR : tdS), wordBreak: "break-word", whiteSpace: "normal", overflow: "hidden" }}>{c}</td>)}
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

  const getPrintSectionNumbers = () => {
    let n = 5;
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
            <Button onClick={() => handleSearch()} disabled={loading} className="shrink-0">
              <Search className="w-4 h-4 mr-1" />{loading ? "..." : "Search"}
            </Button>
          </div>
          {report && (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="Requesting Authority *"
                    value={authority}
                    onChange={e => { setAuthority(e.target.value); setFieldErrors(p => ({ ...p, authority: false })); }}
                    className={fieldErrors.authority ? "border-destructive" : ""}
                  />
                  {fieldErrors.authority && <p className="text-[10px] text-destructive">Required</p>}
                </div>
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="Reference No *"
                    value={refNo}
                    onChange={e => { setRefNo(e.target.value); setFieldErrors(p => ({ ...p, refNo: false })); }}
                    className={fieldErrors.refNo ? "border-destructive" : ""}
                  />
                  {fieldErrors.refNo && <p className="text-[10px] text-destructive">Required</p>}
                </div>
                <div className="space-y-1 sm:max-w-[160px]">
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={e => { setIssueDate(e.target.value); setFieldErrors(p => ({ ...p, issueDate: false })); }}
                    className={fieldErrors.issueDate ? "border-destructive" : ""}
                  />
                  {fieldErrors.issueDate && <p className="text-[10px] text-destructive">Required</p>}
                </div>
                <Button
                  onClick={() => openPdfConfirmation("download")}
                  disabled={generating || hasValidationErrors}
                  variant="destructive"
                  className="shrink-0"
                  title={hasValidationErrors ? "Fill all required fields first" : "Download PDF"}
                >
                  {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}{generating ? "Generating..." : "Download PDF"}
                </Button>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary" /> Compliance Readiness</p>
                  {paginationResult && <Badge variant="outline" className="text-[10px]">PDF: {paginationResult.pages}p · {paginationResult.mode}</Badge>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {readinessItems.map(item => (
                    <div key={item.label} className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-[10px]">
                      {item.ready ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className={item.ready ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Textarea
                  value={internalNote}
                  onChange={e => setInternalNote(e.target.value)}
                  placeholder="Internal manager note (audit history only, not printed on official PDF)"
                  className="min-h-[72px] text-xs"
                  maxLength={500}
                />
                <p className="text-[10px] text-muted-foreground text-right">{internalNote.length}/500</p>
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

      {/* Report ID Badge */}
      {report && reportId && (
        <div className="flex items-center gap-2 px-1">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">Report ID:</span>
          <Badge variant="outline" className="font-mono text-xs">{reportId}</Badge>
        </div>
      )}

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
                      <th className="p-1.5 text-left">Name</th><th className="p-1.5 text-left">Phone</th><th className="p-1.5 text-left">Ref</th><th className="p-1.5 text-left">Status</th>
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

            {/* 4. Roles */}
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
          <div ref={reportRef} style={{ width: 900, padding: 48, background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11, lineHeight: 1.6 }}>
            {/* Branded Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 14, borderBottom: "3px solid #0D9488" }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: "bold", letterSpacing: 1.5, color: "#0D9488", margin: 0 }}>EasyPay</h1>
                <p style={{ fontSize: 9, color: "#666", margin: "3px 0 0" }}>Digital Financial Services • Bangladesh</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 15, fontWeight: "bold", margin: 0, letterSpacing: 1 }}>LAW ENFORCEMENT DISCLOSURE REPORT</p>
                <span style={{ display: "inline-block", marginTop: 4, background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: "bold", padding: "2px 10px", borderRadius: 3, letterSpacing: 1 }}>RESTRICTED</span>
              </div>
            </div>

            {/* Reference Grid */}
            <table style={{ width: "100%", marginBottom: 20, fontSize: 11, borderCollapse: "collapse", border: "1px solid #d0d0d0" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "6px 10px", fontWeight: "bold", color: "#555", background: "#f5f5f5", borderRight: "1px solid #d0d0d0", borderBottom: "1px solid #d0d0d0", width: "25%" }}>Report ID</td>
                  <td style={{ padding: "6px 10px", fontWeight: "bold", borderBottom: "1px solid #d0d0d0", borderRight: "1px solid #d0d0d0", width: "25%" }}>{reportId}</td>
                  <td style={{ padding: "6px 10px", fontWeight: "bold", color: "#555", background: "#f5f5f5", borderRight: "1px solid #d0d0d0", borderBottom: "1px solid #d0d0d0", width: "25%" }}>Issue Date</td>
                  <td style={{ padding: "6px 10px", fontWeight: "bold", borderBottom: "1px solid #d0d0d0", width: "25%" }}>{issueDate ? new Date(issueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "_______________"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 10px", fontWeight: "bold", color: "#555", background: "#f5f5f5", borderRight: "1px solid #d0d0d0", width: "25%" }}>Requesting Authority</td>
                  <td style={{ padding: "6px 10px", fontWeight: "bold", borderRight: "1px solid #d0d0d0" }}>{authority || "_______________"}</td>
                  <td style={{ padding: "6px 10px", fontWeight: "bold", color: "#555", background: "#f5f5f5", borderRight: "1px solid #d0d0d0", width: "25%" }}>Reference No</td>
                  <td style={{ padding: "6px 10px", fontWeight: "bold" }}>{refNo || "_______________"}</td>
                </tr>
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
                { label: "Name" }, { label: "Phone" }, { label: "Ref" }, { label: "Status" },
              ]}
              colWidths={["11%", "7%", "7%", "9%", "7%", "9%", "18%", "12%", "12%", "8%"]}
              fontSize={9}
              rows={report.transactions.map(t => [
                new Date(t.created_at).toLocaleDateString(), t.short_id || "—", t.type,
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
            <div style={{ marginTop: 28, borderTop: "2px solid #0D9488", paddingTop: 16 }}>
              <h2 style={secH}>FINANCIAL SUMMARY</h2>
              <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
                {[
                  ["Total Transactions", report.transactions.length.toString()],
                  ["Money In", `৳${totalIn.toLocaleString()}`],
                  ["Money Out", `৳${totalOut.toLocaleString()}`],
                  ["Fees Paid", `৳${totalFees.toLocaleString()}`],
                  ["Loans Taken", `৳${totalLoansTaken.toLocaleString()}`],
                  ["Loans Repaid", `৳${totalLoansRepaid.toLocaleString()}`],
                  ["Fraud Alerts", report.fraudAlerts.length.toString()],
                  ["Disputes", report.disputes.length.toString()],
                  ["Account Age", `${accountAgeDays} days`],
                ].map(([label, val], i) => (
                  <div key={i} style={{ width: "33.33%", border: "1px solid #e0e0e0", padding: "8px 12px", boxSizing: "border-box" }}>
                    <p style={{ fontSize: 9, color: "#888", margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: "bold", margin: "2px 0 0", color: "#111" }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Authority Signature & Certification */}
            <div style={{ marginTop: 44, paddingTop: 24, borderTop: "2px solid #333" }}>
              <p style={{ fontSize: 12, fontWeight: "bold", marginBottom: 20, letterSpacing: 0.5, textTransform: "uppercase" }}>Certification & Authority Sign-Off</p>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 48 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "#444", marginBottom: 6, fontWeight: "bold" }}>Issuing Officer (EasyPay)</p>
                  <div style={{ borderBottom: "2px solid #333", height: 48, marginBottom: 6 }} />
                  <p style={{ fontSize: 9, color: "#777" }}>Name & Designation</p>
                  <p style={{ fontSize: 9, color: "#777", marginTop: 3 }}>Date: {issueDate ? new Date(issueDate + "T00:00:00").toLocaleDateString("en-GB") : "____/____/________"}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "#444", marginBottom: 6, fontWeight: "bold" }}>Receiving Authority</p>
                  <div style={{ borderBottom: "2px solid #333", height: 48, marginBottom: 6 }} />
                  <p style={{ fontSize: 9, color: "#777" }}>Name, Rank & Badge No.</p>
                  <p style={{ fontSize: 9, color: "#777", marginTop: 3 }}>Authority: {authority || "_______________"}</p>
                  <p style={{ fontSize: 9, color: "#777", marginTop: 3 }}>Ref No: {refNo || "_______________"}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "#444", marginBottom: 6, fontWeight: "bold" }}>Official Seal / Stamp</p>
                  <div style={{ border: "2px dashed #aaa", height: 70, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }}>
                    <span style={{ fontSize: 10, color: "#bbb" }}>[Seal]</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Branded Footer */}
            <div style={{ marginTop: 36, paddingTop: 14, borderTop: "3px solid #0D9488", textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: "bold", color: "#0D9488", margin: 0, letterSpacing: 1 }}>EasyPay — Digital Financial Services</p>
              <p style={{ fontSize: 9, color: "#777", marginTop: 3 }}>Dhaka, Bangladesh • support@easypay.app • www.easypay.app</p>
              <div style={{ marginTop: 10, padding: "6px 0", borderTop: "1px solid #eee" }}>
                <p style={{ fontSize: 9, color: "#999", margin: 0 }}>
                  <span style={{ color: "#dc2626", fontWeight: "bold" }}>RESTRICTED</span> — This document is confidential and intended solely for the requesting law enforcement authority.
                </p>
                <p style={{ fontSize: 9, color: "#999", margin: "2px 0 0" }}>Unauthorized disclosure, reproduction, or distribution is strictly prohibited under applicable law.</p>
              </div>
              <p style={{ fontSize: 8, color: "#bbb", marginTop: 6 }}>Generated by EasyPay Admin System • {new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* LEA Reports History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-5 h-5" />
            LEA Reports History
          </CardTitle>
          <p className="text-xs text-muted-foreground">Previously generated law enforcement disclosure reports.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={historyFilter}
            onChange={e => setHistoryFilter(e.target.value)}
            placeholder="Filter by phone, report ID, authority, or reference no"
            className="text-xs"
          />
          {historyLoading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reports generated yet.</p>
          ) : filteredHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No history records match this filter.</p>
          ) : (
             <div className="overflow-auto max-h-[500px] border rounded">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="text-xs w-8"></TableHead>
                     <TableHead className="text-xs">Report ID</TableHead>
                     <TableHead className="text-xs">Phone</TableHead>
                     <TableHead className="text-xs">Authority</TableHead>
                     <TableHead className="text-xs">Ref No</TableHead>
                     <TableHead className="text-xs">Issue Date</TableHead>
                     <TableHead className="text-xs">Generated</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                     <TableHead className="text-xs text-center">Sections</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                    {filteredHistory.map((h) => {
                     const isSelected = selectedHistoryId === h.id;
                     const admin = adminCache[h.generated_by];
                     const summary = (h.summary && typeof h.summary === "object") ? h.summary as Record<string, any> : {};
                     return (
                       <React.Fragment key={h.id}>
                         <TableRow
                           className="cursor-pointer hover:bg-muted/60 transition-colors"
                           onClick={() => handleSelectHistory(h.id)}
                         >
                           <TableCell className="px-2">
                             <Eye className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                           </TableCell>
                           <TableCell className="font-mono text-[10px]">{h.report_id}</TableCell>
                           <TableCell className="text-xs">{h.phone}</TableCell>
                           <TableCell className="text-xs">{h.authority}</TableCell>
                           <TableCell className="text-xs">{h.reference_no}</TableCell>
                           <TableCell className="text-xs">{h.issue_date}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{new Date(h.generated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px]">Downloaded</Badge></TableCell>
                           <TableCell className="text-xs text-center">{h.sections_included?.length ?? 0}</TableCell>
                         </TableRow>
                         {isSelected && (
                           <TableRow>
                              <TableCell colSpan={9} className="p-0">
                               <div className="bg-muted/40 border-t border-b p-4 space-y-3">
                                 <div className="flex items-center justify-between">
                                   <h4 className="text-sm font-semibold flex items-center gap-1.5">
                                     <Eye className="w-4 h-4 text-primary" /> Audit Detail
                                   </h4>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                          disabled={loading || generating || !!reDownloadingId}
                                         onClick={async (e) => {
                                          e.stopPropagation();
                                           setReDownloadingId(h.id);
                                            setRedownloadPhase("loading");
                                           pendingRedownloadIdRef.current = h.id;
                                          setPhone(h.phone);
                                          setAuthority(h.authority);
                                          setRefNo(h.reference_no);
                                          setIssueDate(h.issue_date);
                                          setReportId(h.report_id);
                                          if (h.sections_included?.length) {
                                            const secs = { ...includeSections };
                                            (Object.keys(OPTIONAL_SECTIONS) as SectionKey[]).forEach(k => {
                                              secs[k] = h.sections_included.includes(k);
                                            });
                                            setIncludeSections(secs);
                                          }
                                           const ok = await handleSearch({ phone: h.phone, reportId: h.report_id });
                                           if (!ok) {
                                             pendingRedownloadIdRef.current = null;
                                             setReDownloadingId(null);
                                              setRedownloadPhase("idle");
                                           } else {
                                              setRedownloadPhase("preparing");
                                              toast.info("Data reloaded. Preparing PDF download...");
                                           }
                                        }}
                                      >
                                         {reDownloadingId === h.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                          {getRedownloadLabel(h.id)}
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setSelectedHistoryId(null); }}>
                                        <X className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                                   <div><span className="text-muted-foreground">Timestamp:</span><br/><span className="font-medium">{new Date(h.generated_at).toISOString()}</span></div>
                                   <div><span className="text-muted-foreground">Admin Name:</span><br/><span className="font-medium">{admin?.name ?? "Loading…"}</span></div>
                                   <div><span className="text-muted-foreground">Admin Phone:</span><br/><span className="font-medium">{admin?.phone ?? "—"}</span></div>
                                   <div><span className="text-muted-foreground">Searched Phone:</span><br/><span className="font-medium">{h.phone}</span></div>
                                   <div><span className="text-muted-foreground">Authority:</span><br/><span className="font-medium">{h.authority}</span></div>
                                   <div><span className="text-muted-foreground">Reference No:</span><br/><span className="font-medium">{h.reference_no}</span></div>
                                   <div><span className="text-muted-foreground">Issue Date:</span><br/><span className="font-medium">{h.issue_date}</span></div>
                                   <div><span className="text-muted-foreground">Report ID:</span><br/><span className="font-mono font-medium">{h.report_id}</span></div>
                                   <div><span className="text-muted-foreground">Download Status:</span><br/><Badge variant="outline" className="text-[10px] mt-0.5">Downloaded ✓</Badge></div>
                                    {summary.page_count != null && <div><span className="text-muted-foreground">PDF Pages:</span><br/><span className="font-medium">{summary.page_count}</span></div>}
                                    {summary.pagination_mode && <div><span className="text-muted-foreground">Pagination:</span><br/><span className="font-medium capitalize">{summary.pagination_mode}</span></div>}
                                 </div>
                                  {summary.internal_note && (
                                    <div className="rounded-md bg-background p-3 text-xs">
                                      <p className="text-muted-foreground mb-1">Internal Manager Note:</p>
                                      <p className="font-medium whitespace-pre-wrap">{summary.internal_note}</p>
                                    </div>
                                  )}
                                 {h.sections_included?.length > 0 && (
                                   <div>
                                     <p className="text-xs text-muted-foreground mb-1">Sections Included:</p>
                                     <div className="flex flex-wrap gap-1">
                                       {h.sections_included.map((s: string) => (
                                         <Badge key={s} variant="secondary" className="text-[10px]">
                                           {(OPTIONAL_SECTIONS as any)[s] || s}
                                         </Badge>
                                       ))}
                                     </div>
                                   </div>
                                 )}
                                 {Object.keys(summary).length > 0 && (
                                   <div>
                                     <p className="text-xs text-muted-foreground mb-1">Summary Stats:</p>
                                     <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                       {summary.total_txns != null && <div className="bg-background rounded p-2 text-center"><p className="text-[10px] text-muted-foreground">Transactions</p><p className="font-semibold text-sm">{summary.total_txns}</p></div>}
                                       {summary.total_in != null && <div className="bg-background rounded p-2 text-center"><p className="text-[10px] text-muted-foreground">Total In</p><p className="font-semibold text-sm text-emerald-600">৳{Number(summary.total_in).toLocaleString()}</p></div>}
                                       {summary.total_out != null && <div className="bg-background rounded p-2 text-center"><p className="text-[10px] text-muted-foreground">Total Out</p><p className="font-semibold text-sm text-red-500">৳{Number(summary.total_out).toLocaleString()}</p></div>}
                                       {summary.fraud_alerts != null && <div className="bg-background rounded p-2 text-center"><p className="text-[10px] text-muted-foreground">Fraud Alerts</p><p className="font-semibold text-sm">{summary.fraud_alerts}</p></div>}
                                       {summary.disputes != null && <div className="bg-background rounded p-2 text-center"><p className="text-[10px] text-muted-foreground">Disputes</p><p className="font-semibold text-sm">{summary.disputes}</p></div>}
                                     </div>
                                   </div>
                                 )}
                               </div>
                             </TableCell>
                           </TableRow>
                         )}
                       </React.Fragment>
                     );
                   })}
                 </TableBody>
               </Table>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
