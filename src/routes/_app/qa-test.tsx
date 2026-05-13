import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, Loader2, PlayCircle, User, Car, Shield, ExternalLink, Route as RouteIcon,
} from "lucide-react";

export const Route = createFileRoute("/_app/qa-test")({
  component: QATestPage,
});

type Status = "idle" | "running" | "pass" | "fail";
type Check = {
  id: string;
  label: string;
  run: () => Promise<string>; // returns success message; throws on failure
};
type Result = { status: Status; message?: string };

function useChecks(checks: Check[]) {
  const [results, setResults] = useState<Record<string, Result>>(() =>
    Object.fromEntries(checks.map((c) => [c.id, { status: "idle" as Status }])),
  );

  const runOne = async (c: Check) => {
    setResults((r) => ({ ...r, [c.id]: { status: "running" } }));
    try {
      const msg = await c.run();
      setResults((r) => ({ ...r, [c.id]: { status: "pass", message: msg } }));
    } catch (e: any) {
      setResults((r) => ({
        ...r,
        [c.id]: { status: "fail", message: e?.message ?? String(e) },
      }));
    }
  };

  const runAll = async () => {
    for (const c of checks) await runOne(c);
  };

  return { results, runOne, runAll };
}

function StatusIcon({ s }: { s: Status }) {
  if (s === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />;
}

function CheckSection({
  title, icon: Icon, checks, accent,
}: { title: string; icon: any; checks: Check[]; accent: string }) {
  const { results, runOne, runAll } = useChecks(checks);
  const counts = Object.values(results).reduce(
    (a, r) => ({
      pass: a.pass + (r.status === "pass" ? 1 : 0),
      fail: a.fail + (r.status === "fail" ? 1 : 0),
    }),
    { pass: 0, fail: 0 },
  );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 rounded-lg grid place-items-center ${accent}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold">{title}</h3>
            <div className="text-xs text-muted-foreground flex gap-2">
              <span className="text-green-600">✓ {counts.pass}</span>
              <span className="text-destructive">✗ {counts.fail}</span>
              <span>/ {checks.length}</span>
            </div>
          </div>
        </div>
        <Button size="sm" onClick={runAll} className="gap-1.5">
          <PlayCircle className="h-4 w-4" /> شغّل الكل
        </Button>
      </div>
      <ul className="divide-y divide-border border rounded-lg overflow-hidden">
        {checks.map((c) => {
          const r = results[c.id];
          return (
            <li key={c.id} className="p-3 flex items-start gap-3 bg-card">
              <div className="pt-0.5"><StatusIcon s={r.status} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{c.label}</div>
                {r.message && (
                  <div
                    className={`text-xs mt-0.5 break-words ${
                      r.status === "fail" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {r.message}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => runOne(c)}
                disabled={r.status === "running"}
              >
                تشغيل
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function QATestPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUid(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      if (data.user) {
        const { data: rs } = await supabase
          .from("user_roles").select("role").eq("user_id", data.user.id);
        setRoles((rs ?? []).map((r) => r.role as string));
      }
    })();
  }, []);

  const requireUid = () => {
    if (!uid) throw new Error("غير مسجّل دخول");
    return uid;
  };

  // ===== Rider checks =====
  const riderChecks: Check[] = [
    {
      id: "auth",
      label: "جلسة المستخدم نشطة",
      run: async () => {
        const id = requireUid();
        return `UID: ${id.slice(0, 8)}…`;
      },
    },
    {
      id: "profile",
      label: "تحميل بيانات الملف الشخصي",
      run: async () => {
        const id = requireUid();
        const { data, error } = await supabase
          .from("profiles").select("full_name,phone,wallet_balance").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("لا يوجد ملف شخصي");
        return `${data.full_name || "بدون اسم"} • محفظة: ${data.wallet_balance} ج.م`;
      },
    },
    {
      id: "pricing",
      label: "إعدادات التسعير متاحة",
      run: async () => {
        const { data, error } = await supabase
          .from("pricing_settings").select("oneway_base,oneway_per_km").eq("id", "default").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("لا توجد إعدادات تسعير");
        return `بداية: ${data.oneway_base} • كم: ${data.oneway_per_km}`;
      },
    },
    {
      id: "trips",
      label: "قراءة سجل الرحلات",
      run: async () => {
        const id = requireUid();
        const { count, error } = await supabase
          .from("rides").select("*", { count: "exact", head: true }).eq("rider_id", id);
        if (error) throw error;
        return `${count ?? 0} رحلة`;
      },
    },
    {
      id: "notifications",
      label: "قراءة الإشعارات",
      run: async () => {
        const id = requireUid();
        const { count, error } = await supabase
          .from("notifications").select("*", { count: "exact", head: true }).eq("user_id", id);
        if (error) throw error;
        return `${count ?? 0} إشعار`;
      },
    },
    {
      id: "ads",
      label: "تحميل الإعلانات النشطة",
      run: async () => {
        const { data, error } = await supabase
          .from("ads").select("id,title").eq("status", "active").limit(5);
        if (error) throw error;
        return `${data?.length ?? 0} إعلان نشط`;
      },
    },
  ];

  // ===== Driver checks =====
  const isDriver = roles.includes("driver");
  const driverChecks: Check[] = [
    {
      id: "drv-role",
      label: "دور السائق ممنوح",
      run: async () => {
        if (!isDriver) throw new Error("هذا المستخدم ليس سائقاً");
        return "✓ driver role";
      },
    },
    {
      id: "drv-docs",
      label: "حالة وثائق السائق",
      run: async () => {
        const id = requireUid();
        const { data, error } = await supabase
          .from("driver_documents")
          .select("approved,account_status")
          .eq("driver_id", id).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("لم يتقدّم بطلب سائق بعد");
        return `موافقة: ${data.approved ? "نعم" : "لا"} • الحالة: ${data.account_status}`;
      },
    },
    {
      id: "drv-loc",
      label: "تحديث موقع السائق (RPC)",
      run: async () => {
        if (!isDriver) throw new Error("هذا المستخدم ليس سائقاً");
        const { error } = await supabase.rpc("update_driver_location", {
          p_lat: 30.0444, p_lng: 31.2357, p_presence: "available",
        });
        if (error) throw error;
        return "تم تحديث الموقع";
      },
    },
    {
      id: "drv-rides",
      label: "قراءة الرحلات المعروضة",
      run: async () => {
        const { count, error } = await supabase
          .from("rides").select("*", { count: "exact", head: true }).eq("status", "searching");
        if (error) throw error;
        return `${count ?? 0} رحلة في الانتظار`;
      },
    },
    {
      id: "drv-commission",
      label: "قراءة عمولات السائق",
      run: async () => {
        const id = requireUid();
        const { data, error } = await supabase
          .from("driver_commissions").select("amount,status").eq("driver_id", id);
        if (error) throw error;
        const unpaid = (data ?? []).filter((r) => r.status === "unpaid")
          .reduce((s, r) => s + Number(r.amount), 0);
        return `عمولات غير مدفوعة: ${unpaid.toFixed(2)} ج.م`;
      },
    },
  ];

  // ===== Admin checks =====
  const isAdmin = roles.includes("admin");
  const adminChecks: Check[] = [
    {
      id: "adm-role",
      label: "دور الأدمن ممنوح",
      run: async () => {
        if (!isAdmin) throw new Error("هذا المستخدم ليس أدمن");
        return "✓ admin role";
      },
    },
    {
      id: "adm-drivers",
      label: "عدد السائقين",
      run: async () => {
        const { count, error } = await supabase
          .from("driver_documents").select("*", { count: "exact", head: true });
        if (error) throw error;
        return `${count ?? 0} سائق`;
      },
    },
    {
      id: "adm-rides",
      label: "إجمالي الرحلات",
      run: async () => {
        const { count, error } = await supabase
          .from("rides").select("*", { count: "exact", head: true });
        if (error) throw error;
        return `${count ?? 0} رحلة`;
      },
    },
    {
      id: "adm-complaints",
      label: "الشكاوى الجديدة",
      run: async () => {
        const { count, error } = await supabase
          .from("complaints").select("*", { count: "exact", head: true }).eq("status", "new");
        if (error) throw error;
        return `${count ?? 0} شكوى جديدة`;
      },
    },
    {
      id: "adm-payouts",
      label: "طلبات السحب المعلّقة",
      run: async () => {
        const { count, error } = await supabase
          .from("withdrawal_requests").select("*", { count: "exact", head: true }).eq("status", "pending");
        if (error) throw error;
        return `${count ?? 0} طلب`;
      },
    },
    {
      id: "adm-geofences",
      label: "مناطق التوصيل",
      run: async () => {
        const { count, error } = await supabase
          .from("geofences").select("*", { count: "exact", head: true }).eq("active", true);
        if (error) throw error;
        return `${count ?? 0} منطقة نشطة`;
      },
    },
    {
      id: "adm-ads",
      label: "إدارة الإعلانات",
      run: async () => {
        const { count, error } = await supabase
          .from("ads").select("*", { count: "exact", head: true });
        if (error) throw error;
        return `${count ?? 0} إعلان إجمالي`;
      },
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30 p-4 lg:p-6 space-y-4" dir="rtl">
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold">اختبار سريع للنظام</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {email ? <>المستخدم: <span className="font-mono">{email}</span></> : "غير مسجّل دخول"}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
            ))}
            {roles.length === 0 && uid && <Badge variant="outline" className="text-[10px]">rider</Badge>}
          </div>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/home"><ExternalLink className="h-3.5 w-3.5" /> شاشة الراكب</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/driver"><ExternalLink className="h-3.5 w-3.5" /> شاشة السائق</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href="/admin" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> داش بورد الأدمن
            </a>
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CheckSection title="مسار الراكب" icon={User} checks={riderChecks} accent="bg-blue-600" />
        <CheckSection title="مسار السائق" icon={Car} checks={driverChecks} accent="bg-amber-600" />
        <CheckSection title="مسار الأدمن" icon={Shield} checks={adminChecks} accent="bg-emerald-600" />
      </div>
    </div>
  );
}
