import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, XCircle, Eye, RefreshCw, User, CreditCard, Calendar,
  ShieldCheck, AlertTriangle, Clock, Phone,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface KycRecord {
  id: string;
  user_id: string;
  full_name: string | null;
  nid_number: string | null;
  date_of_birth: string | null;
  nid_front_url: string | null;
  nid_back_url: string | null;
  nid_photo_url: string | null;
  selfie_url: string | null;
  face_match_score: number | null;
  face_match_result: string | null;
  ocr_raw_data: any;
  status: string;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  pending: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  verified: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  rejected: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
};

const REJECTION_REASONS = [
  "Blurry photo",
  "Name mismatch",
  "Expired NID",
  "Another account verified with this NID",
  "Fake / tampered document",
  "Face mismatch",
  "Incomplete information",
  "Underage applicant",
  "Other",
];

export default function AdminKycReview() {
  const [records, setRecords] = useState<KycRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("pending");
  const [selected, setSelected] = useState<KycRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [userProfile, setUserProfile] = useState<{ phone: string; name: string | null; avatar_url: string | null } | null>(null);
  const [stats, setStats] = useState({ pending: 0, verified: 0, rejected: 0 });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("kyc_verifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load KYC records");
    } else {
      setRecords((data as KycRecord[]) ?? []);
    }
    setLoading(false);
  }, [filter]);

  const loadStats = useCallback(async () => {
    const [p, v, r] = await Promise.all([
      supabase.from("kyc_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("kyc_verifications").select("id", { count: "exact", head: true }).eq("status", "verified"),
      supabase.from("kyc_verifications").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    ]);
    setStats({ pending: p.count ?? 0, verified: v.count ?? 0, rejected: r.count ?? 0 });
  }, []);

  useEffect(() => {
    loadRecords();
    loadStats();
  }, [loadRecords, loadStats]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("admin-kyc-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_verifications" }, () => {
        loadRecords();
        loadStats();
      })
      .subscribe();
  return () => { supabase.removeChannel(channel); };
  }, [loadRecords, loadStats]);

  const getSignedUrl = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const { data } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  };

  const openDetail = async (record: KycRecord) => {
    setSelected(record);
    setReviewNotes(record.reviewer_notes ?? "");
    setRejectionReason("");
    setUserProfile(null);
    // Fetch user profile for phone & avatar
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, name, avatar_url")
      .eq("user_id", record.user_id)
      .maybeSingle();
    if (profile) setUserProfile(profile);
  };

  const previewPhoto = async (path: string | null) => {
    if (!path) return;
    const url = await getSignedUrl(path);
    if (url) setPhotoPreview(url);
    else toast.error("Failed to load photo");
  };

  const handleDecision = async (decision: "verified" | "rejected") => {
    if (!selected) return;
    setSubmitting(true);

    // If approving, check for duplicate NID
    if (decision === "verified" && selected.nid_number) {
      const { data: existing } = await supabase
        .from("kyc_verifications")
        .select("id, user_id")
        .eq("nid_number", selected.nid_number)
        .eq("status", "verified")
        .neq("user_id", selected.user_id)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error("এই NID দিয়ে অন্য একটি অ্যাকাউন্ট ইতোমধ্যে যাচাই করা হয়েছে। Auto-rejecting.");
        // Auto-reject with reason
        await supabase
          .from("kyc_verifications")
          .update({
            status: "rejected",
            reviewer_notes: "[Another account verified with this NID] Auto-rejected: duplicate NID",
            reviewer_id: (await supabase.auth.getUser()).data.user?.id ?? null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", selected.id);
        setSelected(null);
        loadRecords();
        loadStats();
        setSubmitting(false);
        return;
      }
    }

    const finalNotes = decision === "rejected" && rejectionReason
      ? `[${rejectionReason}] ${reviewNotes}`.trim()
      : reviewNotes || null;
    const { error } = await supabase
      .from("kyc_verifications")
      .update({
        status: decision,
        reviewer_notes: finalNotes,
        reviewer_id: (await supabase.auth.getUser()).data.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    if (error) {
      const msg = error.message || "";
      if (msg.includes("face match score")) {
        toast.error("Cannot approve: Face match score must be at least 70%");
      } else if (msg.includes("idx_kyc_unique_verified_nid")) {
        toast.error("Cannot approve: Another account is already verified with this NID");
      } else {
        toast.error("Failed to update KYC status");
      }
    } else {
      toast.success(`KYC ${decision === "verified" ? "approved" : "rejected"} successfully`);

      // Send notifications (in-app + email + SMS)
      try {
        await supabase.functions.invoke("kyc-notify", {
          body: {
            user_id: selected.user_id,
            decision,
            reviewer_notes: reviewNotes || null,
          },
        });
      } catch (notifErr) {
        console.error("Notification send error:", notifErr);
        // Non-blocking — KYC decision already saved
      }

      setSelected(null);
      loadRecords();
    }
    setSubmitting(false);
  };

  const handleReopen = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("kyc_verifications")
      .update({
        status: "pending",
        reviewer_notes: reviewNotes ? `Re-opened: ${reviewNotes}` : "Re-opened for review",
        reviewer_id: (await supabase.auth.getUser()).data.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    if (error) {
      toast.error("Failed to re-open KYC record");
    } else {
      toast.success("KYC record re-opened for review");
      setSelected(null);
      loadRecords();
    }
    setSubmitting(false);
  };

  const matchScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="space-y-4">
      {/* KYC Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending", count: stats.pending, icon: Clock, bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", iconColor: "text-amber-600 dark:text-amber-400" },
          { label: "Verified", count: stats.verified, icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", iconColor: "text-emerald-600 dark:text-emerald-400" },
          { label: "Rejected", count: stats.rejected, icon: XCircle, bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", iconColor: "text-red-600 dark:text-red-400" },
        ].map(s => (
          <Card key={s.label} className={`${s.bg} border-0 shadow-sm`}>
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.iconColor} shrink-0`} />
              <div>
                <p className={`text-xl font-bold ${s.text}`}>{s.count}</p>
                <p className={`text-[11px] font-medium ${s.text} opacity-80`}>{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["pending", "all", "verified", "rejected"] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "pending" ? `Pending (${stats.pending})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
        <Button variant="outline" size="icon" onClick={loadRecords} disabled={loading} className="ml-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Records list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No KYC records found for this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {records.map(record => {
            const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            return (
              <Card key={record.id} className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(record)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {record.full_name || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      NID: {record.nid_number || "—"} • {format(new Date(record.created_at), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {record.face_match_score !== null && (
                      <span className={`text-xs font-bold ${matchScoreColor(record.face_match_score)}`}>
                        {record.face_match_score}%
                      </span>
                    )}
                    <Badge className={`${cfg.color} border-0 gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {record.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              KYC Review
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
          {selected && (
            <div className="space-y-4">
              {/* User identity card */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <Avatar className="h-12 w-12">
                  {userProfile?.avatar_url ? (
                    <AvatarImage src={userProfile.avatar_url} alt="User" />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {(selected.full_name || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selected.full_name || "Unknown"}</p>
                  {userProfile?.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span className="font-mono">{userProfile.phone}</span>
                    </div>
                  )}
                </div>
                <Badge className={`${(STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.pending).color} border-0`}>
                  {selected.status}
                </Badge>
              </div>

              {/* Personal info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Full Name</label>
                  <p className="font-medium text-sm">{selected.full_name || "—"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">NID Number</label>
                  <p className="font-medium text-sm font-mono">{selected.nid_number || "—"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Date of Birth</label>
                  <p className="font-medium text-sm">{selected.date_of_birth || "—"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Submitted</label>
                  <p className="font-medium text-sm">{format(new Date(selected.created_at), "dd MMM yyyy HH:mm")}</p>
                </div>
              </div>

              {/* Face match */}
              <Card className="border">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Face Match Score</span>
                    <span className={`text-lg font-bold ${matchScoreColor(selected.face_match_score)}`}>
                      {selected.face_match_score !== null ? `${selected.face_match_score}%` : "N/A"}
                    </span>
                  </div>
                  {selected.face_match_result && (
                    <p className="text-xs text-muted-foreground mt-1">{selected.face_match_result}</p>
                  )}
                  {selected.face_match_score !== null && selected.face_match_score < 70 && (
                    <div className="flex items-center gap-1.5 mt-2 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Low confidence — review photos carefully</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Photos */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Documents & Photos</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "NID Front", path: selected.nid_front_url, icon: CreditCard },
                    { label: "NID Back", path: selected.nid_back_url, icon: CreditCard },
                    { label: "NID Photo", path: selected.nid_photo_url, icon: User },
                    { label: "Live Selfie", path: selected.selfie_url, icon: User },
                  ].map(item => (
                    <Button
                      key={item.label}
                      variant="outline"
                      size="sm"
                      className="h-auto py-3 flex flex-col items-center gap-1.5"
                      onClick={(e) => { e.stopPropagation(); previewPhoto(item.path); }}
                      disabled={!item.path}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-xs">{item.label}</span>
                      {item.path ? (
                        <Eye className="w-3 h-3 text-primary" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">N/A</span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* OCR extracted summary */}
              {selected.ocr_raw_data && Object.keys(selected.ocr_raw_data).length > 0 && (() => {
                const d = selected.ocr_raw_data as Record<string, any>;
                const pick = (...keys: string[]) => {
                  for (const k of keys) if (d[k]) return String(d[k]);
                  return null;
                };
                const summary = [
                  { label: "Father's Name", value: pick("father_name", "father_name_bn", "fathers_name", "পিতার নাম") },
                  { label: "Mother's Name", value: pick("mother_name", "mother_name_bn", "mothers_name", "মাতার নাম") },
                  { label: "Address", value: pick("address", "address_bn", "permanent_address", "ঠিকানা", "স্থায়ী ঠিকানা") },
                  { label: "Spouse", value: pick("spouse_name", "spouse", "স্বামী/স্ত্রীর নাম") },
                  { label: "Blood Group", value: pick("blood_group", "রক্তের গ্রুপ") },
                ].filter(i => i.value);
                return (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground mb-1 block">OCR Extracted Summary</label>
                    {summary.length > 0 && (
                      <div className="grid grid-cols-1 gap-2">
                        {summary.map(item => (
                          <div key={item.label} className="bg-muted rounded-lg p-2">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</span>
                            <p className="text-sm font-medium">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw OCR JSON</summary>
                      <pre className="bg-muted p-2 rounded-lg overflow-x-auto max-h-32 mt-1">
                        {JSON.stringify(selected.ocr_raw_data, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              })()}

              {/* Rejection reason dropdown */}
              {selected.status === "pending" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Rejection Reason (required to reject)</label>
                  <Select value={rejectionReason} onValueChange={setRejectionReason}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REJECTION_REASONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Admin notes */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Review Notes</label>
                <Textarea
                  placeholder="Add notes about this verification..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  disabled={selected.status !== "pending"}
                />
              </div>

              {/* Previous reviewer info */}
              {selected.status !== "pending" && selected.reviewer_notes && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <span className="font-medium">Previous decision notes:</span> {selected.reviewer_notes}
                </div>
              )}
            </div>
          )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t shrink-0">
            {selected?.status === "pending" ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleDecision("rejected")}
                  disabled={submitting || !rejectionReason}
                  className="gap-1.5"
                  title={!rejectionReason ? "Select a rejection reason first" : ""}
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleDecision("verified")}
                  disabled={submitting}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </Button>
              </>
            ) : selected && (
              <Button
                variant="outline"
                onClick={() => handleReopen()}
                disabled={submitting}
                className="gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                Re-open for Review
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo preview dialog */}
      <Dialog open={!!photoPreview} onOpenChange={(o) => { if (!o) setPhotoPreview(null); }}>
        <DialogContent className="max-w-md p-2">
          {photoPreview && (
            <img
              src={photoPreview}
              alt="KYC Document"
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
