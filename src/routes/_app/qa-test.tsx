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

  // ===== E2E ride flow (rider request → rating) =====
  const e2eRideId = useRef<string | null>(null);
  type RtNotif = {
    id: string;
    user_id: string;
    title: string;
    body: string | null;
    created_at: string;
    read: boolean;
  };
  const e2eRt = useRef<{
    events: RtNotif[];
    byTitle: Map<string, RtNotif>;
    channel: any;
  } | null>(null);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const waitForRtTitle = async (title: string, timeoutMs = 6000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const n = e2eRt.current?.byTitle.get(title);
      if (n) return n;
      await sleep(200);
    }
    return null;
  };

  const e2eChecks: Check[] = [
    {
      id: "e2e-rt-subscribe",
      label: "0) الاشتراك في إشعارات Realtime",
      run: async () => {
        const id = requireUid();
        if (e2eRt.current?.channel) {
          await supabase.removeChannel(e2eRt.current.channel);
        }
        const events: RtNotif[] = [];
        const byTitle = new Map<string, RtNotif>();
        const channel = supabase
          .channel(`qa-notifs-${id}-${Date.now()}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${id}` },
            (payload: any) => {
              const n = payload?.new as RtNotif | undefined;
              if (n && typeof n.title === "string") {
                events.push(n);
                byTitle.set(n.title, n);
              }
            },
          );
        const status = await new Promise<string>((resolve) => {
          channel.subscribe((s: string) => resolve(s));
        });
        if (status !== "SUBSCRIBED") throw new Error(`فشل الاشتراك (${status})`);
        e2eRt.current = { events, byTitle, channel };
        return "✓ مشترك في قناة الإشعارات";
      },
    },

    {

      id: "e2e-create",
      label: "1) إنشاء طلب رحلة من الراكب",
      run: async () => {
        const id = requireUid();
        e2eRideId.current = null;
        const { data, error } = await supabase.from("rides").insert({
          rider_id: id,
          pickup_address: "[QA] مدينة نصر",
          destination_address: "[QA] المعادي",
          pickup_lat: 30.0626, pickup_lng: 31.3399,
          destination_lat: 29.9603, destination_lng: 31.2569,
          ride_type: "private",
          distance_km: 12.5,
          duration_min: 25,
          price: 75,
          status: "searching",
        }).select("id").single();
        if (error) throw error;
        e2eRideId.current = data.id;
        return `تم الإنشاء — ride: ${data.id.slice(0, 8)}…`;
      },
    },
    {
      id: "e2e-notif",
      label: "2) تأكيد إشعار «تم الحجز»",
      run: async () => {
        const id = requireUid();
        if (!e2eRideId.current) throw new Error("شغّل خطوة الإنشاء أولاً");
        await sleep(500);
        const { data, error } = await supabase
          .from("notifications").select("title,body")
          .eq("user_id", id).order("created_at", { ascending: false }).limit(1);
        if (error) throw error;
        const last = data?.[0];
        if (!last || last.title !== "تم الحجز") throw new Error("لم يصل الإشعار");
        return `✓ ${last.title}`;
      },
    },
    {
      id: "e2e-accept",
      label: "3) قبول السائق للرحلة تلقائيًا (accepted)",
      run: async () => {
        const id = requireUid();
        if (!e2eRideId.current) throw new Error("لا توجد رحلة اختبارية");
        const { error } = await supabase.from("rides")
          .update({
            driver_id: id,
            status: "accepted",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", e2eRideId.current);
        if (error) throw error;
        return "تم تعيين السائق • status=accepted";
      },
    },
    {
      id: "e2e-verify-accepted",
      label: "4) التحقق من انتقال الحالة إلى accepted",
      run: async () => {
        if (!e2eRideId.current) throw new Error("لا توجد رحلة اختبارية");
        await sleep(300);
        const { data, error } = await supabase.from("rides")
          .select("status,driver_id,accepted_at").eq("id", e2eRideId.current).single();
        if (error) throw error;
        if (data.status !== "accepted") throw new Error(`status=${data.status} (متوقع accepted)`);
        if (!data.driver_id) throw new Error("لم يتم تعيين سائق");
        if (!data.accepted_at) throw new Error("accepted_at فارغ");
        return `✓ accepted • driver: ${data.driver_id.slice(0, 8)}…`;
      },
    },
    {
      id: "e2e-start",
      label: "5) بدء الرحلة (in_progress)",
      run: async () => {
        if (!e2eRideId.current) throw new Error("لا توجد رحلة اختبارية");
        const { data: pre, error: preErr } = await supabase.from("rides")
          .select("status").eq("id", e2eRideId.current).single();
        if (preErr) throw preErr;
        if (pre.status !== "accepted")
          throw new Error(`يجب أن تكون accepted قبل البدء (الحالية: ${pre.status})`);
        const { error } = await supabase.from("rides")
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("id", e2eRideId.current);
        if (error) throw error;
        return "حالة الرحلة: in_progress";
      },
    },
    {
      id: "e2e-verify-started",
      label: "5.1) التحقق من ضبط started_at",
      run: async () => {
        if (!e2eRideId.current) throw new Error("لا توجد رحلة اختبارية");
        const { data, error } = await supabase.from("rides")
          .select("status,started_at").eq("id", e2eRideId.current).single();
        if (error) throw error;
        if (data.status !== "in_progress")
          throw new Error(`الحالة ليست in_progress (${data.status})`);
        if (!data.started_at)
          throw new Error("started_at لم يُضبط");
        const ts = new Date(data.started_at).getTime();
        if (Number.isNaN(ts))
          throw new Error("started_at غير صالح");
        if (Date.now() - ts > 5 * 60 * 1000)
          throw new Error("started_at قديم جدًا");
        return `✓ started_at: ${new Date(ts).toLocaleTimeString("ar")}`;
      },
    },
    {
      id: "e2e-rt-verify",
      label: "5.2) وصول إشعارات Realtime + سلامة payload.new",
      run: async () => {
        if (!e2eRt.current) throw new Error("لم يتم الاشتراك بـ Realtime — شغّل الخطوة 0 أولاً");
        if (!e2eRideId.current) throw new Error("لا توجد رحلة اختبارية");
        const uid = requireUid();
        const expected = ["تم الحجز", "السائق قبل رحلتك", "بدأت الرحلة"];

        // 1) الانتظار حتى وصول كل العناوين المتوقعة
        const arrived: Record<string, RtNotif> = {};
        const missing: string[] = [];
        for (const t of expected) {
          const n = await waitForRtTitle(t, 6000);
          if (!n) missing.push(t);
          else arrived[t] = n;
        }
        if (missing.length) throw new Error(`لم تصل: ${missing.join("، ")}`);

        // 2) فحص بنية payload.new لكل إشعار
        const required: (keyof RtNotif)[] = ["id", "user_id", "title", "body", "created_at", "read"];
        for (const t of expected) {
          const n = arrived[t];
          for (const k of required) {
            if (!(k in n)) throw new Error(`payload.new ناقص "${k}" في «${t}»`);
          }
          if (typeof n.id !== "string" || n.id.length < 10)
            throw new Error(`id غير صالح في «${t}»`);
          if (n.user_id !== uid)
            throw new Error(`user_id غير مطابق في «${t}» (الفعلي: ${n.user_id})`);
          if (typeof n.title !== "string" || n.title !== t)
            throw new Error(`title غير مطابق في «${t}»`);
          if (n.body !== null && typeof n.body !== "string")
            throw new Error(`body من نوع غير متوقع في «${t}»`);
          if (typeof n.read !== "boolean")
            throw new Error(`read ليس boolean في «${t}»`);
          const ts = new Date(n.created_at).getTime();
          if (Number.isNaN(ts)) throw new Error(`created_at غير صالح في «${t}»`);
        }

        // 3) ربط الإشعارات بالرحلة عبر التسلسل الزمني لأحداث rides
        const { data: ride, error: rErr } = await supabase.from("rides")
          .select("id,rider_id,created_at,accepted_at,started_at")
          .eq("id", e2eRideId.current).single();
        if (rErr) throw rErr;
        if (ride.rider_id !== uid)
          throw new Error("rider_id الرحلة لا يطابق المستخدم الحالي");

        const within = (a: string, b: string | null, sec = 30) => {
          if (!b) return false;
          return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= sec * 1000;
        };
        if (!within(arrived["تم الحجز"].created_at, ride.created_at))
          throw new Error("توقيت «تم الحجز» لا يطابق إنشاء الرحلة");
        if (!within(arrived["السائق قبل رحلتك"].created_at, ride.accepted_at))
          throw new Error("توقيت «السائق قبل رحلتك» لا يطابق accepted_at");
        if (!within(arrived["بدأت الرحلة"].created_at, ride.started_at))
          throw new Error("توقيت «بدأت الرحلة» لا يطابق started_at");

        // 4) التحقق من الترتيب الزمني الصحيح للإشعارات
        const tBooked = new Date(arrived["تم الحجز"].created_at).getTime();
        const tAccepted = new Date(arrived["السائق قبل رحلتك"].created_at).getTime();
        const tStarted = new Date(arrived["بدأت الرحلة"].created_at).getTime();
        if (!(tBooked <= tAccepted)) {
          throw new Error(
            `ترتيب زمني خاطئ: «تم الحجز» (${new Date(tBooked).toLocaleTimeString("ar")}) بعد «السائق قبل رحلتك» (${new Date(tAccepted).toLocaleTimeString("ar")})`,
          );
        }
        if (!(tAccepted <= tStarted)) {
          throw new Error(
            `ترتيب زمني خاطئ: «السائق قبل رحلتك» (${new Date(tAccepted).toLocaleTimeString("ar")}) بعد «بدأت الرحلة» (${new Date(tStarted).toLocaleTimeString("ar")})`,
          );
        }

        // 5) التحقق من حدود الفارق الزمني المنطقية
        const MAX_BOOKED_TO_ACCEPTED_MS = 5 * 60 * 1000; // 5 دقائق
        const MAX_ACCEPTED_TO_STARTED_MS = 3 * 60 * 1000; // 3 دقائق
        const fmtSec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
        const dBA = tAccepted - tBooked;
        const dAS = tStarted - tAccepted;
        if (dBA > MAX_BOOKED_TO_ACCEPTED_MS) {
          throw new Error(
            `الفارق بين «تم الحجز» و«السائق قبل رحلتك» كبير جدًا: ${fmtSec(dBA)} (الحد ${fmtSec(MAX_BOOKED_TO_ACCEPTED_MS)})`,
          );
        }
        if (dAS > MAX_ACCEPTED_TO_STARTED_MS) {
          throw new Error(
            `الفارق بين «السائق قبل رحلتك» و«بدأت الرحلة» كبير جدًا: ${fmtSec(dAS)} (الحد ${fmtSec(MAX_ACCEPTED_TO_STARTED_MS)})`,
          );
        }

        return `✓ ${expected.length} إشعارات صحيحة • ترتيب ✓ • Δحجز→قبول ${fmtSec(dBA)} • Δقبول→بدء ${fmtSec(dAS)} • رحلة ${ride.id.slice(0, 8)}…`;
      },
    },
    {
      id: "e2e-complete",
      label: "6) إنهاء الرحلة (completed)",
      run: async () => {
        if (!e2eRideId.current) throw new Error("لا توجد رحلة اختبارية");
        const { error } = await supabase.from("rides")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", e2eRideId.current);
        if (error) throw error;
        return "حالة الرحلة: completed";
      },
    },
    {
      id: "e2e-rate",
      label: "7) تقييم الراكب للرحلة",
      run: async () => {
        if (!e2eRideId.current) throw new Error("لا توجد رحلة اختبارية");
        const { error } = await supabase.from("rides")
          .update({ rating: 5, rating_comment: "[QA] رحلة اختبار ممتازة" })
          .eq("id", e2eRideId.current);
        if (error) throw error;
        return "★ 5/5";
      },
    },
    {
      id: "e2e-verify",
      label: "8) التحقق النهائي من الرحلة",
      run: async () => {
        if (!e2eRideId.current) throw new Error("لا توجد رحلة اختبارية");
        const { data, error } = await supabase.from("rides")
          .select("status,rating,completed_at").eq("id", e2eRideId.current).single();
        if (error) throw error;
        if (data.status !== "completed") throw new Error(`status=${data.status}`);
        if (data.rating !== 5) throw new Error("التقييم لم يُحفظ");
        return `مكتملة • ★${data.rating}`;
      },
    },
  ];

  // ===== Mock Clock — يضمن ثبات نتائج اختبارات التأخير بغضّ النظر عن سرعة الشبكة =====
  type MockClock = {
    install: () => void;
    uninstall: () => void;
    advance: (ms: number) => void;
    set: (ms: number) => void;
    now: () => number;
    nowISO: () => string;
    isInstalled: () => boolean;
  };
  const createMockClock = (startMs = Date.parse("2025-01-01T00:00:00.000Z")): MockClock => {
    let current = startMs;
    let installed = false;
    const RealDate = Date;
    const realNow = Date.now.bind(Date);
    return {
      install() {
        if (installed) return;
        installed = true;
        (Date as any).now = () => current;
        const Patched: any = function (this: any, ...args: any[]) {
          if (args.length === 0) return new RealDate(current);
          // @ts-ignore
          return new RealDate(...args);
        };
        Patched.now = () => current;
        Patched.parse = RealDate.parse;
        Patched.UTC = RealDate.UTC;
        Patched.prototype = RealDate.prototype;
        (globalThis as any).Date = Patched;
      },
      uninstall() {
        if (!installed) return;
        installed = false;
        (globalThis as any).Date = RealDate;
        (RealDate as any).now = realNow;
      },
      advance(ms: number) { current += ms; },
      set(ms: number) { current = ms; },
      now() { return current; },
      nowISO() { return new RealDate(current).toISOString(); },
      isInstalled() { return installed; },
    };
  };
  const withMockClock = async <T,>(fn: (clock: MockClock) => Promise<T> | T, startMs?: number): Promise<T> => {
    const clock = createMockClock(startMs);
    clock.install();
    try {
      return await fn(clock);
    } finally {
      clock.uninstall();
    }
  };

  // ===== Negative tests: تأخير مقصود يجب أن يفشل التحقق (مع Mock Clock للثبات) =====
  const MAX_BOOKED_TO_ACCEPTED_MS = 5 * 60 * 1000;
  const MAX_ACCEPTED_TO_STARTED_MS = 3 * 60 * 1000;
  const fmtSec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  const validateNotifTiming = (booked: string, accepted: string, started: string) => {
    const tB = new Date(booked).getTime();
    const tA = new Date(accepted).getTime();
    const tS = new Date(started).getTime();
    if (!(tB <= tA))
      throw new Error("ترتيب زمني خاطئ: «تم الحجز» بعد «السائق قبل رحلتك»");
    if (!(tA <= tS))
      throw new Error("ترتيب زمني خاطئ: «السائق قبل رحلتك» بعد «بدأت الرحلة»");
    const dBA = tA - tB;
    const dAS = tS - tA;
    if (dBA > MAX_BOOKED_TO_ACCEPTED_MS)
      throw new Error(
        `الفارق بين «تم الحجز» و«السائق قبل رحلتك» كبير جدًا: ${fmtSec(dBA)} (الحد ${fmtSec(MAX_BOOKED_TO_ACCEPTED_MS)})`,
      );
    if (dAS > MAX_ACCEPTED_TO_STARTED_MS)
      throw new Error(
        `الفارق بين «السائق قبل رحلتك» و«بدأت الرحلة» كبير جدًا: ${fmtSec(dAS)} (الحد ${fmtSec(MAX_ACCEPTED_TO_STARTED_MS)})`,
      );
    return { dBA, dAS };
  };

  const expectFailure = (
    fn: () => unknown,
    expectedSubstr: string,
    label: string,
  ) => {
    try {
      fn();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (!msg.includes(expectedSubstr))
        throw new Error(
          `${label}: فشل لكن برسالة غير متوقعة — "${msg}" (متوقع يحوي: "${expectedSubstr}")`,
        );
      return msg;
    }
    throw new Error(`${label}: لم يفشل التحقق رغم تجاوز الحد المنطقي`);
  };

  const negativeChecks: Check[] = [
    {
      id: "neg-baseline-pass",
      label: "0) سيناريو طبيعي يمر بدون أخطاء (sanity)",
      run: async () => {
        const now = Date.now();
        const r = validateNotifTiming(
          new Date(now).toISOString(),
          new Date(now + 30_000).toISOString(),
          new Date(now + 60_000).toISOString(),
        );
        return `✓ Δحجز→قبول ${fmtSec(r.dBA)} • Δقبول→بدء ${fmtSec(r.dAS)}`;
      },
    },
    {
      id: "neg-accept-delay",
      label: "1) تأخير قبول السائق 7 دقائق → يجب أن يفشل (>5د)",
      run: async () => {
        const now = Date.now();
        const booked = new Date(now).toISOString();
        const accepted = new Date(now + 7 * 60 * 1000).toISOString();
        const started = new Date(now + 7 * 60 * 1000 + 30_000).toISOString();
        const msg = expectFailure(
          () => validateNotifTiming(booked, accepted, started),
          "«تم الحجز» و«السائق قبل رحلتك» كبير جدًا",
          "تأخير قبول",
        );
        return `✓ فشل كما هو متوقع — ${msg}`;
      },
    },
    {
      id: "neg-start-delay",
      label: "2) تأخير بدء الرحلة 5 دقائق → يجب أن يفشل (>3د)",
      run: async () => {
        const now = Date.now();
        const booked = new Date(now).toISOString();
        const accepted = new Date(now + 30_000).toISOString();
        const started = new Date(now + 30_000 + 5 * 60 * 1000).toISOString();
        const msg = expectFailure(
          () => validateNotifTiming(booked, accepted, started),
          "«السائق قبل رحلتك» و«بدأت الرحلة» كبير جدًا",
          "تأخير بدء",
        );
        return `✓ فشل كما هو متوقع — ${msg}`;
      },
    },
    {
      id: "neg-out-of-order",
      label: "3) ترتيب مقلوب (قبول قبل الحجز) → يجب أن يفشل",
      run: async () => {
        const now = Date.now();
        const booked = new Date(now + 60_000).toISOString();
        const accepted = new Date(now).toISOString();
        const started = new Date(now + 90_000).toISOString();
        const msg = expectFailure(
          () => validateNotifTiming(booked, accepted, started),
          "ترتيب زمني خاطئ",
          "ترتيب مقلوب",
        );
        return `✓ فشل كما هو متوقع — ${msg}`;
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

      <CheckSection title="رحلة كاملة (راكب ← تقييم)" icon={RouteIcon} checks={e2eChecks} accent="bg-purple-600" />
      <CheckSection title="فشل متعمد — حدود زمنية للإشعارات" icon={XCircle} checks={negativeChecks} accent="bg-rose-600" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CheckSection title="مسار الراكب" icon={User} checks={riderChecks} accent="bg-blue-600" />
        <CheckSection title="مسار السائق" icon={Car} checks={driverChecks} accent="bg-amber-600" />
        <CheckSection title="مسار الأدمن" icon={Shield} checks={adminChecks} accent="bg-emerald-600" />
      </div>
    </div>
  );
}
