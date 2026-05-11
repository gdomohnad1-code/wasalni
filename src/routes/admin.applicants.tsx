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
  adminUploadDriverDoc,
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
import { Loader2, Check, X, AlertCircle, Clock, Eye, Plus, Copy, Upload } from "lucide-react";
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

      {showAdd && isMainAdmin && (
        <ManualAddDriverDialog onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />
      )}
    </div>
  );
}

type DocKind =
  | "id_card_front"
  | "id_card_back"
  | "selfie"
  | "driver_license"
  | "car_photo"
  | "car_license";

const DOC_FIELDS: { kind: DocKind; label: string; urlField: string }[] = [
  { kind: "id_card_front", label: "صورة البطاقة (وجه)", urlField: "id_card_front_url" },
  { kind: "id_card_back", label: "صورة البطاقة (ظهر)", urlField: "id_card_back_url" },
  { kind: "selfie", label: "السيلفي", urlField: "selfie_url" },
  { kind: "driver_license", label: "رخصة القيادة", urlField: "driver_license_url" },
  { kind: "car_photo", label: "صورة السيارة", urlField: "car_photo_url" },
  { kind: "car_license", label: "رخصة السيارة", urlField: "car_license_url" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ManualAddDriverDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(manuallyCreateDriver);
  const upload = useServerFn(adminUploadDriverDoc);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    car_type: "",
    car_model: "",
    car_plate: "",
  });
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [uploadingKind, setUploadingKind] = useState<DocKind | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const genPw = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let s = "";
    for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
    set("password", s);
  };

  const handleFile = async (kind: DocKind, urlField: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) return toast.error("الحد الأقصى 10MB");
    setUploadingKind(kind);
    try {
      const base64 = await fileToBase64(file);
      const res: any = await upload({
        data: {
          kind,
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          base64,
        },
      });
      setDocs((p) => ({ ...p, [urlField]: res.path }));
      toast.success("تم رفع الملف ✅");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الرفع");
    } finally {
      setUploadingKind(null);
    }
  };

  const submit = async () => {
    if (!form.email || !form.password || !form.full_name) {
      return toast.error("البريد وكلمة المرور والاسم مطلوبون");
    }
    setBusy(true);
    try {
      await create({
        data: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          car_type: form.car_type.trim() || null,
          car_model: form.car_model.trim() || null,
          car_plate: form.car_plate.trim() || null,
          ...docs,
        } as any,
      });
      toast.success("تم إنشاء حساب السائق ✅");
      setCreated({ email: form.email.trim(), password: form.password });
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الإنشاء");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>إضافة سائق يدوياً</DialogTitle></DialogHeader>
        {created ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              تم إنشاء الحساب. يمكن للسائق تسجيل الدخول الآن.
            </div>
            <CredRow label="البريد" value={created.email} />
            <CredRow label="كلمة المرور" value={created.password} />
            <DialogFooter>
              <Button onClick={onClose}>إغلاق</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              يمكنك إنشاء حساب سائق جاهز للعمل حتى لو الأوراق غير مكتملة. الحقول الإجبارية فقط: البريد، كلمة المرور، الاسم.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Field label="البريد الإلكتروني *"><Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" /></Field>
              <Field label="كلمة المرور *">
                <div className="flex gap-2">
                  <Input value={form.password} onChange={(e) => set("password", e.target.value)} />
                  <Button type="button" variant="outline" size="sm" onClick={genPw}>توليد</Button>
                </div>
              </Field>
              <Field label="الاسم الكامل *"><Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
              <Field label="الهاتف"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="نوع السيارة"><Input value={form.car_type} onChange={(e) => set("car_type", e.target.value)} /></Field>
                <Field label="الموديل"><Input value={form.car_model} onChange={(e) => set("car_model", e.target.value)} /></Field>
                <Field label="اللوحة"><Input value={form.car_plate} onChange={(e) => set("car_plate", e.target.value)} /></Field>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="text-sm font-semibold">المستندات (اختياري)</div>
              <div className="grid grid-cols-1 gap-2">
                {DOC_FIELDS.map((d) => {
                  const uploaded = !!docs[d.urlField];
                  const isUp = uploadingKind === d.kind;
                  return (
                    <div key={d.kind} className="flex items-center gap-2 border rounded-lg p-2">
                      <div className="flex-1 text-xs">
                        <div className="font-medium">{d.label}</div>
                        {uploaded && <div className="text-green-600 truncate">تم الرفع ✓</div>}
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          disabled={isUp || busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(d.kind, d.urlField, f);
                            e.target.value = "";
                          }}
                        />
                        <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted">
                          {isUp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          {uploaded ? "استبدال" : "رفع"}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>إلغاء</Button>
              <Button onClick={submit} disabled={busy || !!uploadingKind} className="bg-gradient-primary">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء الحساب"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
      <div className="text-xs text-muted-foreground w-24 shrink-0">{label}</div>
      <div className="flex-1 font-mono text-sm break-all">{value}</div>
      <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(value); toast.success("تم النسخ"); }}>
        <Copy className="h-4 w-4" />
      </Button>
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
