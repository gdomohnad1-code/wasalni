import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, AlertCircle, Clock, CheckCircle2, XCircle, Filter, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_app/admin/complaints")({
  component: AdminComplaintsPage,
});

type Complaint = {
  id: string;
  user_id: string;
  ride_id: string | null;
  category: string;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  admin_response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  profile?: { full_name: string; phone: string | null; avatar_url: string | null } | null;
};

const STATUS_META: Record<Complaint["status"], { label: string; icon: any; class: string }> = {
  new: { label: "جديدة", icon: AlertCircle, class: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  in_progress: { label: "قيد المعالجة", icon: Clock, class: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  resolved: { label: "تم الحل", icon: CheckCircle2, class: "bg-primary/10 text-primary border-primary/20" },
  closed: { label: "مغلقة", icon: XCircle, class: "bg-muted text-muted-foreground border-border" },
};

const PRIORITY_META: Record<Complaint["priority"], { label: string; class: string }> = {
  low: { label: "منخفضة", class: "bg-muted text-muted-foreground" },
  medium: { label: "متوسطة", class: "bg-blue-500/10 text-blue-600" },
  high: { label: "عالية", class: "bg-orange-500/10 text-orange-600" },
  urgent: { label: "عاجلة", class: "bg-destructive/10 text-destructive" },
};

function AdminComplaintsPage() {
  const { roles, user, loading: authLoading } = useAuth();
  const isAdmin = roles?.includes("admin");

  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Complaint["status"]>("all");
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [response, setResponse] = useState("");
  const [newStatus, setNewStatus] = useState<Complaint["status"]>("in_progress");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذر تحميل الشكاوى");
      setLoading(false);
      return;
    }
    const userIds = [...new Set((data ?? []).map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url")
      .in("id", userIds);
    const map = new Map(profiles?.map((p) => [p.id, p]) ?? []);
    setItems((data ?? []).map((c) => ({ ...c, profile: map.get(c.user_id) ?? null })) as Complaint[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("complaints-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const openComplaint = (c: Complaint) => {
    setSelected(c);
    setResponse(c.admin_response ?? "");
    setNewStatus(c.status === "new" ? "in_progress" : c.status);
  };

  const submit = async () => {
    if (!selected || !user) return;
    setSaving(true);
    const payload: any = {
      status: newStatus,
      admin_response: response.trim() || null,
    };
    if (response.trim()) {
      payload.responded_by = user.id;
      payload.responded_at = new Date().toISOString();
    }
    const { error } = await supabase.from("complaints").update(payload).eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error("تعذر حفظ التغييرات");
      return;
    }
    toast.success("تم تحديث الشكوى");
    setSelected(null);
    load();
  };

  const filtered = filter === "all" ? items : items.filter((c) => c.status === filter);
  const counts = {
    all: items.length,
    new: items.filter((c) => c.status === "new").length,
    in_progress: items.filter((c) => c.status === "in_progress").length,
    resolved: items.filter((c) => c.status === "resolved").length,
    closed: items.filter((c) => c.status === "closed").length,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <XCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">غير مصرح</h2>
        <p className="text-muted-foreground">هذه الصفحة مخصصة للإدارة فقط</p>
        <Link to="/home"><Button>العودة للرئيسية</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/home"><Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold">إدارة الشكاوى والتقارير</h1>
            <p className="text-xs text-muted-foreground">{counts.all} شكوى إجمالاً</p>
          </div>
        </div>
        <Filter className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-5 gap-2">
        {([
          ["all", "الكل"],
          ["new", "جديدة"],
          ["in_progress", "قيد المعالجة"],
          ["resolved", "تم الحل"],
          ["closed", "مغلقة"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-xs font-semibold transition ${
              filter === key
                ? "bg-primary text-primary-foreground border-primary shadow-elegant"
                : "bg-card border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <span className="text-base font-bold">{counts[key]}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا توجد شكاوى ضمن هذا التصنيف</Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((c) => {
              const meta = STATUS_META[c.status];
              const Icon = meta.icon;
              const pmeta = PRIORITY_META[c.priority];
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Card className="p-4 cursor-pointer hover:shadow-elegant transition" onClick={() => openComplaint(c)}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{c.subject}</h3>
                        <p className="text-xs text-muted-foreground">
                          {c.profile?.full_name || "مستخدم"} • {c.category}
                        </p>
                      </div>
                      <Badge className={`${meta.class} border gap-1`} variant="outline">
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2 mb-2">{c.message}</p>
                    <div className="flex items-center justify-between text-xs">
                      <Badge className={pmeta.class} variant="secondary">{pmeta.label}</Badge>
                      <span className="text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الشكوى</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-lg">{selected.subject}</h3>
                <p className="text-xs text-muted-foreground">
                  {selected.profile?.full_name} {selected.profile?.phone && `• ${selected.profile.phone}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected.category} • {new Date(selected.created_at).toLocaleString("ar-EG")}
                </p>
              </div>
              <Card className="p-3 bg-muted/40">
                <p className="text-sm whitespace-pre-wrap">{selected.message}</p>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block">الحالة</label>
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as Complaint["status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">جديدة</SelectItem>
                      <SelectItem value="in_progress">قيد المعالجة</SelectItem>
                      <SelectItem value="resolved">تم الحل</SelectItem>
                      <SelectItem value="closed">مغلقة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">الأولوية</label>
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30">
                    <Badge className={PRIORITY_META[selected.priority].class} variant="secondary">
                      {PRIORITY_META[selected.priority].label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">رد الإدارة</label>
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="اكتب رداً للمستخدم..."
                  rows={4}
                />
                {selected.admin_response && selected.responded_at && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    آخر رد: {new Date(selected.responded_at).toLocaleString("ar-EG")}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>إلغاء</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
