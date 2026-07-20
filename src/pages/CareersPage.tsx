import Seo from "@/components/Seo";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Briefcase, MapPin, Clock, Send, Loader2, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string;
  type: string;
  description: string | null;
  requirements: string | null;
  created_at: string;
}

export default function CareersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", cover_note: "" });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("job_listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setJobs((data as Job[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const handleApply = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error(t("crNamePhoneRequired"));
      return;
    }
    if (!user) { toast.error(t("crSignInToApply")); return; }
    setApplying(true);
    const { error } = await supabase.from("job_applications").insert({
      job_id: selectedJob!.id,
      user_id: user.id,
      applicant_name: form.name.trim(),
      applicant_phone: form.phone.trim(),
      applicant_email: form.email.trim() || null,
      cover_note: form.cover_note.trim() || null,
    });
    if (error) { toast.error(error.message); setApplying(false); return; }
    setApplied(true);
    setApplying(false);
  };

  const TYPE_COLORS: Record<string, string> = {
    "full-time": "bg-primary/10 text-primary",
    "part-time": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    "contract": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Careers at EasyPay – Join the Fintech Revolution"
        description="Open roles at EasyPay. Help build Bangladesh's leading digital wallet across engineering, product, design, operations and support."
        path="/careers"
        jsonLd={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "EasyPay Careers", url: "https://pay-palooza-go.lovable.app/careers" }}
      />
      <div className="sticky top-0 z-40 gradient-hero text-primary-foreground border-b border-primary/30 shadow-glow px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold text-foreground">{t("crHeader")}</h1>
      </div>

      <div className="px-4 pt-4 pb-20 space-y-4">
        <div className="text-center py-4">
          <h2 className="text-xl font-extrabold text-foreground">{t("crJoinTeam")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("crJoinSub")}</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">{t("crLoadingOpenings")}</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("crNoOpenings")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("crCheckBack")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job, i) => (
              <motion.button
                key={job.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => { setSelectedJob(job); setShowApply(false); setApplied(false); setForm({ name: "", phone: "", email: "", cover_note: "" }); }}
                className="w-full text-left bg-card rounded-2xl border border-border p-4 space-y-2 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.department || t("crGeneral")}</p>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${TYPE_COLORS[job.type] || ""}`}>{job.type}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Job Detail Sheet */}
      <AnimatePresence>
        {selectedJob && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedJob(null)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-50 max-w-md mx-auto bg-background rounded-t-3xl border-t border-border shadow-lg max-h-[85vh] overflow-y-auto"
            >
              <div className="px-5 pt-4 pb-2 flex items-center justify-between sticky top-0 bg-background z-10">
                <h2 className="text-lg font-extrabold text-foreground">{selectedJob.title}</h2>
                <button onClick={() => setSelectedJob(null)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 pb-8 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className={TYPE_COLORS[selectedJob.type] || ""}>{selectedJob.type}</Badge>
                  <Badge variant="outline"><MapPin className="w-3 h-3 mr-1" />{selectedJob.location}</Badge>
                  {selectedJob.department && <Badge variant="outline">{selectedJob.department}</Badge>}
                </div>

                {selectedJob.description && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">{t("crDescription")}</p>
                    <p className="text-sm text-foreground whitespace-pre-line">{selectedJob.description}</p>
                  </div>
                )}

                {selectedJob.requirements && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">{t("crRequirements")}</p>
                    <p className="text-sm text-foreground whitespace-pre-line">{selectedJob.requirements}</p>
                  </div>
                )}

                {!showApply && !applied && (
                  <Button className="w-full h-12" onClick={() => setShowApply(true)}>
                    <Send className="w-4 h-4 mr-2" /> {t("crApplyNow")}
                  </Button>
                )}

                {applied && (
                  <div className="text-center py-4 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
                    <p className="font-bold text-foreground">{t("crApplicationSubmitted")}</p>
                    <p className="text-xs text-muted-foreground">{t("crApplicationReview")}</p>
                  </div>
                )}

                {showApply && !applied && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 border-t border-border pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("crYourApplication")}</p>
                    <Input placeholder={t("crFullNameReq")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <Input placeholder={t("crPhoneReq")} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    <Input placeholder={t("crEmailOpt")} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    <Textarea placeholder={t("crCoverNoteOpt")} value={form.cover_note} onChange={e => setForm({ ...form, cover_note: e.target.value })} rows={3} />
                    <Button className="w-full h-12" onClick={handleApply} disabled={applying}>
                      {applying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      {t("crSubmitApp")}
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
