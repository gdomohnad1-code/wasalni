import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, BellRing, Send, RefreshCw, CheckCircle2, XCircle, Smartphone } from "lucide-react";
import { isFcmConfigured, registerFcmTokenForCurrentUser } from "@/lib/fcm-web";
import { sendTestPushToSelf, listMyDeviceTokens } from "@/lib/push-test.functions";

export const Route = createFileRoute("/_app/push-test")({
  component: PushTestPage,
});

type DeviceToken = { token: string; platform: string | null; created_at: string };

function PushTestPage() {
  const [configured, setConfigured] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [registering, setRegistering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("اختبار الإشعارات 🚖");
  const [body, setBody] = useState("لو وصلك ده، يبقى Push شغال تمام!");

  const sendFn = useServerFn(sendTestPushToSelf);
  const listFn = useServerFn(listMyDeviceTokens);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listFn();
      setTokens(list as DeviceToken[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setConfigured(isFcmConfigured());
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    } else {
      setPermission("unsupported");
    }
    refresh();
  }, []);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const res = await registerFcmTokenForCurrentUser();
      if (res.ok) {
        toast.success("تم تفعيل الإشعارات على هذا الجهاز ✅");
        setPermission("granted");
        await refresh();
      } else {
        const map: Record<string, string> = {
          "not-configured": "Firebase غير مهيأ — يلزم إضافة مفاتيح VITE_FIREBASE_*",
          unsupported: "المتصفح لا يدعم Push",
          iframe: "افتح الصفحة في تبويب جديد (مش داخل المعاينة)",
          "no-user": "سجّل الدخول أولاً",
          "permission-denied": "رفضت السماح بالإشعارات",
          "no-sw": "فشل تسجيل Service Worker",
          "no-token": "تعذّر الحصول على Token",
        };
        toast.error(map[res.reason ?? ""] ?? `خطأ: ${res.reason ?? "غير معروف"}`);
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendFn({ data: { title, body } });
      if (res.message === "no-tokens") {
        toast.error("لا يوجد جهاز مسجّل بعد. اضغط «تفعيل الإشعارات» أولاً.");
      } else {
        toast.success(`تم الإرسال: نجح ${res.success} / فشل ${res.failure} (من أصل ${res.tokens})`);
        await refresh();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الإرسال");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <BellRing className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">اختبار الإشعارات</h1>
      </div>

      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold">الحالة</div>
        <Row
          label="إعدادات Firebase"
          ok={configured}
          okText="مهيأ"
          failText="غير مهيأ — يلزم VITE_FIREBASE_*"
        />
        <Row
          label="إذن المتصفح"
          ok={permission === "granted"}
          okText="مسموح"
          failText={permission === "denied" ? "مرفوض" : permission === "unsupported" ? "غير مدعوم" : "لم يُطلب"}
        />
        <Row
          label="أجهزة مسجّلة"
          ok={tokens.length > 0}
          okText={`${tokens.length} جهاز`}
          failText="لا يوجد"
        />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">الخطوة 1 — فعّل على هذا الجهاز</div>
        <p className="text-xs text-muted-foreground">
          افتح الرابط في متصفح الموبايل (وليس داخل المعاينة) ثم اضغط الزر للسماح بالإشعارات.
        </p>
        <Button onClick={handleRegister} disabled={registering || !configured} className="w-full gap-2">
          <Bell className="h-4 w-4" />
          {registering ? "جارٍ التفعيل..." : "تفعيل الإشعارات على هذا الجهاز"}
        </Button>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">الخطوة 2 — أرسل إشعار تجريبي لنفسك</div>
        <div className="space-y-2">
          <Label className="text-xs">العنوان</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">النص</Label>
          <Input value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <Button onClick={handleSend} disabled={sending || tokens.length === 0} className="w-full gap-2">
          <Send className="h-4 w-4" />
          {sending ? "جارٍ الإرسال..." : "إرسال إشعار تجريبي"}
        </Button>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">أجهزتي المسجّلة</div>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا يوجد أجهزة مسجّلة بعد.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <li key={t.token} className="flex items-start gap-2 text-xs border-t pt-2">
                <Smartphone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono truncate">{t.token.slice(0, 24)}…</div>
                  <div className="text-muted-foreground">
                    {t.platform ?? "web"} • {new Date(t.created_at).toLocaleString("ar-EG")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, ok, okText, failText }: { label: string; ok: boolean; okText: string; failText: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1 font-semibold ${ok ? "text-green-600" : "text-destructive"}`}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {ok ? okText : failText}
      </span>
    </div>
  );
}
