import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/admin/complaints")({
  component: ComplaintsAdmin,
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
  responded_at: string | null;
  created_at: string;
  profile?: { full_name: string; phone: string | null } | null;
};

const STATUS: Record<Complaint["status"], { label: string; icon: any; class: string }> = {
  new: { label: "جديدة", icon: AlertCircle, class: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  in_progress: { label: "قيد المراجعة", icon: Clock, class: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  resolved: { label: "محلولة", icon: CheckCircle2, class: "bg-primary/10 text-primary border-primary/20" },
  closed: { label: "مغلقة", icon: XCircle, class: "bg-muted text-muted-foreground border-border" },
};

function ComplaintsAdmin() {
  const { user } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Complaint["status"]>("all");
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [response, setResponse] = useState("");
  const [newStatus, setNewStatus] = useState<Complaint["status"]>("in_progress");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
    const ids = [...new Set((data ?? []).map((c) => c.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
    const map = new Map(profs?.map((p) => [p.id, p]) ?? []);
    setItems((data ?? []).map((c) => ({ ...c, profile: map.get(c.user_id) ?? null })) as Complaint[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-complaints")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const open = (c: Complaint) => {
    setSelected(c);
    setResponse(c.admin_response ?? "");
    setNewStatus(c.status === "new" ? "in_progress" : c.status);
  };

  const submit = async () => {
    if (!selected || !user) return;
    setBusy(true);
    const payload: any = { status: newStatus };
    if (response.trim()) {
      payload.admin_response = response.trim();
      payload.responded_by = user.id;
      payload.responded_at = new Date().toISOString();
    }
    const { error } = await supabase.from("complaints").update(payload).eq("id", selected.id);
    if (!error && response.trim()) {
      await supabase.from("notifications").insert({
        user_id: selected.user_id,
        title: "رد على شكواك",
        body: response.trim().slice(0, 200),
      } as any).then(() => {});
    }
    setBusy(false);
    if (error) { toast.error("تعذر التحديث"); return; }
    toast.success("تم الحفظ");
    setSelected(null); load();
  };

  const filtered = filter === "all" ? items : items.filter((c) => c.status === filter);
  const counts = {
    all: items.length,
    new: items.filter((c) => c.status === "new").length,
    in_progress: items.filter((c) => c.status === "in_progress").length,
    resolved: items.filter((c) => c.status === "resolved").length,
    closed: items.filter((c) => c.status === "closed").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ["all", "الكل"], ["new", "جديدة"], ["in_progress", "قيد المراجعة"],
          ["resolved", "محلولة"], ["closed", "مغلقة"],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
              filter === k ? "bg-primary text-primary-foreground border-primary shadow-elegant" : "bg-card border-border text-muted-foreground hover:border-primary/40"
            }`}>
            {l} <span className="text-[11px] opacity-80">({counts[k]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا توجد شكاوى</Card>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {filtered.map((c) => {
              const m = STATUS[c.status]; const Icon = m.icon;
              return (
                <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Card className="p-4 cursor-pointer hover:shadow-elegant transition" onClick={() => open(c)}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{c.subject}</h3>
                        <p className="text-xs text-muted-foreground">{c.profile?.full_name || "—"} • {c.category}</p>
                      </div>
                      <Badge className={`${m.class} border gap-1`} variant="outline"><Icon className="h-3 w-3" />{m.label}</Badge>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2">{c.message}</p>
                    <div className="text-[11px] text-muted-foreground mt-2">{new Date(c.created_at).toLocaleString("ar-EG")}</div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>تفاصيل الشكوى</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg">{selected.subject}</h3>
                <p className="text-xs text-muted-foreground">{selected.profile?.full_name} {selected.profile?.phone && `• ${selected.profile.phone}`}</p>
                <p className="text-xs text-muted-foreground">{selected.category} • {new Date(selected.created_at).toLocaleString("ar-EG")}</p>
              </div>
              <Card className="p-3 bg-muted/40"><p className="text-sm whitespace-pre-wrap">{selected.message}</p></Card>
              <div>
                <label className="text-xs font-semibold mb-1 block">الحالة</label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">جديدة</SelectItem>
                    <SelectItem value="in_progress">قيد المراجعة</SelectItem>
                    <SelectItem value="resolved">محلولة</SelectItem>
                    <SelectItem value="closed">مغلقة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">رد الإدارة</label>
                <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="اكتب رداً للمستخدم..." rows={4} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>إلغاء</Button>
            <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin ml-2" />}حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
