import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listApplications,
  getApplicationDetail,
  approveApplication,
  rejectApplication,
  requestApplicationChanges,
  manuallyCreateDriver,
} from "@/lib/driver-applications.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Check, X, AlertCircle, Clock, Eye, Plus, Copy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/applicants")({
  component: ApplicantsPage,
});

const FIELD_LABELS: Record<string, string> = {
  id_card_front_url: "صورة البطاقة (وجه)",
  id_card_back_url: "صورة البطاقة (ظهر)",
  selfie_url: "السيلفي",
  driver_license_url: "رخصة القيادة",
  car_photo_url: "صورة السيارة",
  car_license_url: "رخصة السيارة",
  car_type: "نوع السيارة",
  car_model: "موديل السيارة",
  car_plate: "رقم اللوحة",
};

function ApplicantsPage() {
  const list = useServerFn(listApplications);
  const [tab, setTab] = useState<"pending" | "changes_requested" | "rejected">("pending");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const { user } = useAuth();
  const isMainAdmin = user?.email?.toLowerCase() === "admin@wasalni.app";

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await list({ data: { status: tab } });
      setItems(res.applications ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التحميل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const labels: Record<typeof tab, string> = {
    pending: "قيد المراجعة",
    changes_requested: "بانتظار التعديل",
    rejected: "مرفوضة",
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">المقدّمون</h2>
          <p className="text-sm text-muted-foreground">طلبات الانضمام كسائق</p>
        </div>
        {isMainAdmin && (
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-primary">
            <Plus className="h-4 w-4 ml-1" /> إضافة سائق يدوياً
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="pending">قيد المراجعة</TabsTrigger>
          <TabsTrigger value="changes_requested">بانتظار التعديل</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">لا توجد طلبات في قسم "{labels[tab]}"</Card>
      ) : (
        <div className="grid gap-3">
          {items.map((a) => <ApplicantRow key={a.driver_id} a={a} onView={() => setSelected(a.driver_id)} />)}
        </div>
      )}

      {selected && (
        <ApplicantDetailDialog
          driverId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}

function ApplicantRow({ a, onView }: { a: any; onView: () => void }) {
  const submitted = a.submitted_at ? new Date(a.submitted_at) : null;
  const deadline = submitted ? submitted.getTime() + 48 * 3600_000 : null;
  const remaining = deadline ? Math.max(0, deadline - Date.now()) : 0;
  const hrs = Math.floor(remaining / 3600_000);

  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="h-12 w-12 rounded-full bg-muted grid place-items-center font-bold text-lg shrink-0">
        {a.profile?.full_name?.[0] ?? "؟"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold truncate">{a.profile?.full_name ?? "بدون اسم"}</div>
        <div className="text-xs text-muted-foreground truncate">
          {a.profile?.phone ?? "—"} · {a.car_model ?? "—"} · {a.car_plate ?? "—"}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {a.account_status === "pending" && (
            <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> {hrs} ساعة متبقية</Badge>
          )}
          {a.account_status === "changes_requested" && (
            <Badge variant="outline" className="gap-1 border-amber-400 text-amber-600"><AlertCircle className="h-3 w-3" /> بانتظار التعديل</Badge>
          )}
          {a.account_status === "rejected" && (
            <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> مرفوض ({a.rejection_count}x)</Badge>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onView}><Eye className="h-4 w-4 ml-1" /> عرض</Button>
    </Card>
  );
}

function ApplicantDetailDialog({ driverId, onClose, onChanged }: { driverId: string; onClose: () => void; onChanged: () => void }) {
  const getDetail = useServerFn(getApplicationDetail);
  const approve = useServerFn(approveApplication);
  const reject = useServerFn(rejectApplication);
  const requestChanges = useServerFn(requestApplicationChanges);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "reject" | "changes">("view");
  const [reason, setReason] = useState("");
  const [fields, setFields] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await getDetail({ data: { driverId } });
        setData(res);
      } catch (e: any) {
        toast.error(e?.message ?? "تعذّر التحميل");
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [driverId]);

  const doApprove = async () => {
    setBusy(true);
    try { await approve({ data: { driverId } }); toast.success("تم القبول ✅"); onChanged(); }
    catch (e: any) { toast.error(e?.message ?? "فشل"); }
    finally { setBusy(false); }
  };

  const doReject = async () => {
    if (reason.trim().length < 3) return toast.error("اكتب سبب الرفض");
    setBusy(true);
    try { await reject({ data: { driverId, reason: reason.trim() } }); toast.success("تم الرفض"); onChanged(); }
    catch (e: any) { toast.error(e?.message ?? "فشل"); }
    finally { setBusy(false); }
  };

  const doRequestChanges = async () => {
    if (fields.length === 0) return toast.error("اختر حقلاً واحداً على الأقل");
    if (reason.trim().length < 3) return toast.error("اكتب رسالة توضيح");
    setBusy(true);
    try {
      await requestChanges({ data: { driverId, fields, message: reason.trim() } });
      toast.success("تم طلب التعديل");
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "فشل"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>تفاصيل الطلب</DialogTitle></DialogHeader>
        {loading || !data ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3">
              <div className="font-bold">{data.profile?.full_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{data.profile?.phone ?? "—"}</div>
            </div>

            <Section title="بيانات السيارة">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Info label="النوع" v={data.application.car_type} />
                <Info label="الموديل" v={data.application.car_model} />
                <Info label="رقم اللوحة" v={data.application.car_plate} />
                <Info label="عدد الرفض" v={String(data.application.rejection_count ?? 0)} />
              </div>
            </Section>

            <Section title="الصور المرفوعة">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(FIELD_LABELS).slice(0, 6).map(([k, label]) => (
                  <ImageBox key={k} label={label} src={data.signedUrls[k]} />
                ))}
              </div>
            </Section>

            {mode === "view" && (
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50" onClick={() => { setMode("changes"); setReason(""); setFields([]); }}>
                  <AlertCircle className="h-4 w-4 ml-1" /> طلب تعديل
                </Button>
                <Button variant="destructive" onClick={() => { setMode("reject"); setReason(""); }}>
                  <X className="h-4 w-4 ml-1" /> رفض
                </Button>
                <Button onClick={doApprove} disabled={busy} className="bg-gradient-primary">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 ml-1" /> قبول</>}
                </Button>
              </DialogFooter>
            )}

            {mode === "reject" && (
              <div className="space-y-3 border-t pt-4">
                <Label>سبب الرفض (سيتم إرساله للمستخدم)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اشرح سبب الرفض..." rows={3} />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setMode("view")}>إلغاء</Button>
                  <Button variant="destructive" onClick={doReject} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد الرفض"}
                  </Button>
                </div>
              </div>
            )}

            {mode === "changes" && (
              <div className="space-y-3 border-t pt-4">
                <Label>اختر الحقول المطلوب تعديلها</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(FIELD_LABELS).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted text-sm">
                      <Checkbox
                        checked={fields.includes(k)}
                        onCheckedChange={(c) => {
                          setFields((p) => c ? [...p, k] : p.filter((x) => x !== k));
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <Label>رسالة توضيح للمستخدم</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً: صورة البطاقة غير واضحة، يرجى التقاط صورة بإضاءة جيدة..." rows={3} />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setMode("view")}>إلغاء</Button>
                  <Button onClick={doRequestChanges} disabled={busy} className="bg-amber-500 hover:bg-amber-600">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال طلب التعديل"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Info({ label, v }: { label: string; v: string | null | undefined }) {
  return (
    <div className="bg-muted rounded p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm">{v || "—"}</div>
    </div>
  );
}

function ImageBox({ label, src }: { label: string; src?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer">
          <img src={src} alt={label} className="w-full h-32 object-cover rounded-lg border hover:opacity-80 transition" />
        </a>
      ) : (
        <div className="w-full h-32 rounded-lg border border-dashed grid place-items-center text-xs text-muted-foreground">لا توجد صورة</div>
      )}
    </div>
  );
}
