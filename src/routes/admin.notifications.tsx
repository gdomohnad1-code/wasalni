import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Send, Users, Car, User2, UsersRound } from "lucide-react";
import { sendBroadcastNotification } from "@/lib/admin-notifications.functions";

export const Route = createFileRoute("/admin/notifications")({
  component: NotificationsPage,
});

type Audience = "all" | "drivers" | "riders" | "drivers_riders";

const AUDIENCES: { value: Audience; label: string; icon: any }[] = [
  { value: "all",            label: "جميع المستخدمين",        icon: Users },
  { value: "drivers",        label: "السائقين فقط",            icon: Car },
  { value: "riders",         label: "العملاء فقط",             icon: User2 },
  { value: "drivers_riders", label: "السائقين والعملاء معًا", icon: UsersRound },
];

function NotificationsPage() {
  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const send = useServerFn(sendBroadcastNotification);

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("اكتب العنوان والمحتوى");
      return;
    }
    setSending(true);
    try {
      const res = await send({ data: { audience, title: title.trim(), body: body.trim() } });
      toast.success(`تم إرسال الإشعار إلى ${res.sent} مستخدم`);
      setTitle(""); setBody("");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر الإرسال");
    } finally {
      setSending(false);
    }
  };

  const audienceMeta = AUDIENCES.find((a) => a.value === audience)!;
  const Icon = audienceMeta.icon;

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      <div>
        <h2 className="text-2xl font-extrabold flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          الإشعارات الجماعية
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          أرسل إشعارًا داخل التطبيق لفئة محددة من المستخدمين. سيظهر فورًا في صندوق الإشعارات الخاص بكل مستلم.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="space-y-2">
          <Label>المستلمون</Label>
          <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUDIENCES.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>عنوان الإشعار</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: عرض خاص اليوم"
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label>محتوى الإشعار</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب الرسالة التي ستصل للمستخدمين…"
            rows={5}
            maxLength={1000}
          />
          <div className="text-xs text-muted-foreground">{body.length}/1000</div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            سيُرسَل إلى: <span className="font-semibold text-foreground">{audienceMeta.label}</span>
          </div>
          <Button onClick={submit} disabled={sending} className="gap-2">
            <Send className="h-4 w-4" />
            {sending ? "جارٍ الإرسال…" : "إرسال الإشعار"}
          </Button>
        </div>
      </Card>

      <Card className="p-5 bg-muted/30">
        <h3 className="font-bold mb-2">معاينة</h3>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{title || "عنوان الإشعار"}</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {body || "محتوى الإشعار سيظهر هنا."}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
