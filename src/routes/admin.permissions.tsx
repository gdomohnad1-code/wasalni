import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Crown, KeyRound, UserCog, Wallet, Bell, Eye,
  CheckCircle2, XCircle, ShieldQuestion, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/admin/permissions")({
  component: PermissionsTestPage,
});

type AdminPerm =
  | "super_admin" | "full_control" | "assigner"
  | "collections" | "notifications" | "viewer";

const PERM_META: Record<AdminPerm, { label: string; icon: any; color: string }> = {
  super_admin:    { label: "مسؤول رئيسي",   icon: Crown,    color: "text-amber-500" },
  full_control:   { label: "تحكم كامل",     icon: KeyRound, color: "text-primary" },
  assigner:       { label: "مسؤول تعيين",   icon: UserCog,  color: "text-blue-500" },
  collections:    { label: "مسؤول التحصيل", icon: Wallet,   color: "text-emerald-500" },
  notifications:  { label: "إشعارات",       icon: Bell,     color: "text-fuchsia-500" },
  viewer:         { label: "معاينة فقط",    icon: Eye,      color: "text-muted-foreground" },
};

// ما الأذونات المطلوبة لكل قسم في اللوحة
const SECTIONS: { path: string; title: string; needs: AdminPerm[]; reason: string }[] = [
  { path: "/admin",            title: "نظرة عامة",         needs: ["viewer", "full_control", "super_admin", "assigner", "collections", "notifications"], reason: "متاح لكل مَن يدخل اللوحة." },
  { path: "/admin/drivers",    title: "السائقون",           needs: ["assigner", "full_control", "super_admin"], reason: "تعديل وقبول/رفض السائقين يحتاج صلاحية تعيين." },
  { path: "/admin/dues",       title: "مستحقات الشركة",     needs: ["collections", "full_control", "super_admin"], reason: "إثبات الدفع والتجميد يحتاج مسؤول تحصيل." },
  { path: "/admin/payouts",    title: "سحوبات السائقين",    needs: ["collections", "full_control", "super_admin"], reason: "اعتماد/رفض السحوبات يحتاج مسؤول تحصيل." },
  { path: "/admin/complaints", title: "الشكاوى",            needs: ["full_control", "super_admin"], reason: "الرد على الشكاوى يحتاج تحكم كامل." },
  { path: "/admin/rides",      title: "الرحلات",            needs: ["viewer", "full_control", "super_admin"], reason: "متاح للعرض. تعديل الحالة يحتاج تحكم كامل." },
  { path: "/admin/reports",    title: "التقارير",           needs: ["viewer", "full_control", "super_admin", "collections"], reason: "متاح للعرض والتحصيل." },
  { path: "/admin/admins",     title: "المسؤولون والأدوار",  needs: ["super_admin"], reason: "إدارة المسؤولين حصرية للمسؤول الرئيسي." },
];

function PermissionsTestPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; email: string | null; name: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [perm, setPerm] = useState<AdminPerm | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: profile }, { data: roles }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("admin_permissions").select("permission").eq("user_id", user.id),
    ]);

    setMe({ id: user.id, email: user.email ?? null, name: profile?.full_name ?? "—" });
    setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
    setPerm((perms?.[0]?.permission as AdminPerm) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const can = (needs: AdminPerm[]) => {
    if (!perm) return false;
    if (perm === "super_admin") return true;
    return needs.includes(perm);
  };

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">جاري التحميل…</div>;
  }

  const meta = perm ? PERM_META[perm] : null;
  const Icon = meta?.icon ?? ShieldQuestion;

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2">
            <ShieldQuestion className="h-6 w-6 text-primary" />
            اختبار الصلاحيات
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            هذه الصفحة تعرض هويتك وأذوناتك الحالية، وتشرح لكل قسم: هل تستطيع الوصول؟ ولماذا؟
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" /> تحديث
        </Button>
      </div>

      {/* My identity */}
      <Card className="p-5">
        <h3 className="font-bold mb-4">هويتك</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Row label="الاسم" value={me?.name ?? "—"} />
          <Row label="البريد" value={<span dir="ltr" className="font-mono">{me?.email ?? "—"}</span>} />
          <Row label="معرف الحساب" value={<span dir="ltr" className="font-mono text-xs">{me?.id ?? "—"}</span>} />
          <Row
            label="دور الحساب"
            value={
              isAdmin
                ? <Badge className="bg-primary text-primary-foreground">admin</Badge>
                : <Badge variant="destructive">ليس أدمن</Badge>
            }
          />
        </div>
      </Card>

      {/* Current permission */}
      <Card className="p-5">
        <h3 className="font-bold mb-4">دورك الفرعي الحالي</h3>
        {perm ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border">
            <div className={`h-12 w-12 rounded-xl bg-card grid place-items-center shadow-elegant ${meta!.color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="font-extrabold text-lg">{meta!.label}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">{perm}</div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            لم يتم تعيين دور فرعي لحسابك بعد. اطلب من المسؤول الرئيسي تعيين دور لك من «المسؤولون».
          </div>
        )}
      </Card>

      {/* Section access matrix */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-bold">أقسام لوحة الإدارة</h3>
          <p className="text-xs text-muted-foreground mt-1">
            ✓ يعني تستطيع الوصول بدورك الحالي. ✗ يعني الوصول مرفوض ويظهر سبب الرفض.
          </p>
        </div>
        <div className="divide-y divide-border">
          {SECTIONS.map((s) => {
            const allowed = can(s.needs);
            return (
              <div key={s.path} className="p-4 flex items-start gap-3">
                <div className={`mt-0.5 ${allowed ? "text-emerald-500" : "text-destructive"}`}>
                  {allowed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{s.title}</span>
                    <code className="text-[11px] text-muted-foreground" dir="ltr">{s.path}</code>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{s.reason}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[11px] text-muted-foreground">الأدوار المسموح لها:</span>
                    {s.needs.map((p) => (
                      <Badge
                        key={p}
                        variant={perm === p || perm === "super_admin" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {PERM_META[p].label}
                      </Badge>
                    ))}
                  </div>
                  {!allowed && (
                    <div className="mt-2 text-xs text-destructive">
                      {!perm
                        ? "السبب: لا يوجد دور فرعي معيّن لحسابك."
                        : `السبب: دورك «${meta!.label}» ليس ضمن الأدوار المسموح لها بهذا القسم.`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        ملاحظة: الحماية الفعلية للبيانات تتم عبر سياسات RLS في قاعدة البيانات. هذه الصفحة تشرح المنطق فقط.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
