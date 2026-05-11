import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Search, Wallet, AlertTriangle, BellRing, Pause, CheckCircle2,
  CreditCard, Filter, Loader2,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/dues")({
  component: DuesPage,
});

interface DriverRow {
  driver_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  car_plate: string | null;
  car_model: string | null;
  account_status: string;
  due_amount: number;
  unpaid_count: number;
  oldest_unpaid: string | null;
  days_overdue: number;
}

const FREEZE_DAYS = 5;
const REMINDER_DAYS = 3;

function DuesPage() {
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "over500" | "frozen" | "overdue">("all");
  const [acting, setActing] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = async () => {
    setLoading(true);

    const { data: docs } = await supabase
      .from("driver_documents")
      .select("driver_id, car_plate, car_model, account_status");

    const driverIds = (docs ?? []).map((d) => d.driver_id);
    if (driverIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const [{ data: profiles }, { data: commissions }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone")
        .in("id", driverIds),
      supabase
        .from("driver_commissions")
        .select("driver_id, amount, created_at, status")
        .eq("status", "unpaid")
        .in("driver_id", driverIds),
    ]);

    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const dueMap = new Map<string, { total: number; count: number; oldest: string }>();
    for (const c of commissions ?? []) {
      const k = c.driver_id;
      const cur = dueMap.get(k) ?? { total: 0, count: 0, oldest: c.created_at };
      cur.total += Number(c.amount);
      cur.count += 1;
      if (c.created_at < cur.oldest) cur.oldest = c.created_at;
      dueMap.set(k, cur);
    }

    const now = Date.now();
    const result: DriverRow[] = (docs ?? []).map((d: any) => {
      const p: any = profMap.get(d.driver_id) ?? {};
      const due = dueMap.get(d.driver_id);
      const days = due
        ? Math.floor((now - new Date(due.oldest).getTime()) / 86400000)
        : 0;
      return {
        driver_id: d.driver_id,
        full_name: p.full_name ?? "—",
        avatar_url: p.avatar_url ?? null,
        phone: p.phone ?? null,
        car_plate: d.car_plate,
        car_model: d.car_model,
        account_status: d.account_status,
        due_amount: due?.total ?? 0,
        unpaid_count: due?.count ?? 0,
        oldest_unpaid: due?.oldest ?? null,
        days_overdue: days,
      };
    });

    result.sort((a, b) => b.due_amount - a.due_amount);
    setRows(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.full_name} ${r.phone ?? ""} ${r.car_plate ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "over500" && r.due_amount < 500) return false;
      if (filter === "frozen" && r.account_status !== "suspended") return false;
      if (filter === "overdue" && r.days_overdue < FREEZE_DAYS) return false;
      return true;
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    const totalDue = rows.reduce((s, r) => s + r.due_amount, 0);
    return {
      drivers: rows.filter((r) => r.due_amount > 0).length,
      total: totalDue,
      frozen: rows.filter((r) => r.account_status === "suspended").length,
      overdue: rows.filter((r) => r.days_overdue >= FREEZE_DAYS).length,
    };
  }, [rows]);

  const markPaid = async (driverId: string) => {
    setActing(driverId);
    const { error } = await supabase.rpc("mark_driver_paid", { p_driver_id: driverId });
    setActing(null);
    if (error) return toast.error("تعذّر تأكيد الدفع");
    toast.success("تم تسجيل الدفع وتفعيل الحساب");
    load();
  };

  const suspend = async (driverId: string) => {
    setActing(driverId);
    const { error } = await supabase
      .from("driver_documents")
      .update({
        account_status: "suspended",
        suspension_reason: "تجميد يدوي - مستحقات غير مدفوعة",
      })
      .eq("driver_id", driverId);
    setActing(null);
    if (error) return toast.error("تعذّر التجميد");
    toast.success("تم تجميد الحساب");
    load();
  };

  const reactivate = async (driverId: string) => {
    setActing(driverId);
    const { error } = await supabase
      .from("driver_documents")
      .update({ account_status: "active", suspension_reason: null })
      .eq("driver_id", driverId);
    setActing(null);
    if (error) return toast.error("تعذّر التفعيل");
    toast.success("تم تفعيل الحساب");
    load();
  };

  const sendReminder = async (driver: DriverRow) => {
    setActing(driver.driver_id);
    const { error } = await supabase.from("notifications").insert({
      user_id: driver.driver_id,
      title: "تذكير بدفع المستحقات",
      body: `لديك مستحقات بقيمة ${driver.due_amount.toFixed(2)} ج.م. يجب سدادها قبل ${
        FREEZE_DAYS - driver.days_overdue
      } أيام لتجنب تجميد الحساب.`,
    } as any);
    if (!error) {
      await supabase
        .from("driver_documents")
        .update({ last_reminder_at: new Date().toISOString() })
        .eq("driver_id", driver.driver_id);
    }
    setActing(null);
    if (error) return toast.error("تعذّر إرسال التذكير");
    toast.success("تم إرسال التذكير للسائق");
  };

  const bulkPayOverdue = async () => {
    if (!confirm("سيتم تسجيل دفع كل المستحقات للسائقين المتأخرين (≥ 5 أيام). متابعة؟")) return;
    setBulkLoading(true);
    const { data, error } = await supabase.rpc("mark_all_overdue_paid", { p_min_amount: 0 });
    setBulkLoading(false);
    if (error) return toast.error("تعذّر التنفيذ");
    toast.success(`تم تسديد مستحقات ${data ?? 0} سائق`);
    load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="إجمالي المستحقات" value={`${stats.total.toFixed(2)} ج.م`} icon={Wallet} tone="primary" />
        <StatCard label="سائقون مدينون" value={stats.drivers.toString()} icon={CreditCard} />
        <StatCard label="حسابات مجمدة" value={stats.frozen.toString()} icon={Pause} tone="warn" />
        <StatCard label="متأخرون (≥5 أيام)" value={stats.overdue.toString()} icon={AlertTriangle} tone="danger" />
      </div>

      {/* Toolbar */}
      <Card className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم، الهاتف، رقم اللوحة…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <div className="flex gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل السائقين</SelectItem>
              <SelectItem value="over500">أكثر من 500 ج.م</SelectItem>
              <SelectItem value="frozen">المجمدون</SelectItem>
              <SelectItem value="overdue">المتأخرون (≥5 أيام)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={bulkPayOverdue}
          disabled={bulkLoading || stats.overdue === 0}
          variant="default"
          className="gap-2"
        >
          {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          دفع جماعي للمتأخرين
        </Button>
      </Card>

      {/* Cards grid */}
      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا توجد نتائج</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <DriverDueCard
              key={r.driver_id}
              row={r}
              acting={acting === r.driver_id}
              onPay={() => markPaid(r.driver_id)}
              onSuspend={() => suspend(r.driver_id)}
              onReactivate={() => reactivate(r.driver_id)}
              onRemind={() => sendReminder(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, tone = "default",
}: {
  label: string;
  value: string;
  icon: any;
  tone?: "default" | "primary" | "warn" | "danger";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl grid place-items-center ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-extrabold truncate">{value}</div>
      </div>
    </Card>
  );
}

function DriverDueCard({
  row, acting, onPay, onSuspend, onReactivate, onRemind,
}: {
  row: DriverRow;
  acting: boolean;
  onPay: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onRemind: () => void;
}) {
  const isFrozen = row.account_status === "suspended";
  const isOverdue = row.days_overdue >= FREEZE_DAYS;
  const isWarning = row.days_overdue >= REMINDER_DAYS && !isOverdue;

  return (
    <Card className={`p-4 flex flex-col gap-3 transition border-2 ${
      isFrozen ? "border-destructive/40 bg-destructive/5" :
      isOverdue ? "border-amber-500/50" :
      isWarning ? "border-amber-500/30" :
      "border-transparent"
    }`}>
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14 border-2 border-border">
          <AvatarImage src={row.avatar_url ?? undefined} />
          <AvatarFallback>{row.full_name.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{row.full_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {row.phone ?? "—"} · {row.car_plate ?? "بدون لوحة"}
          </div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {isFrozen && <Badge variant="destructive" className="text-[10px] h-5">مجمد</Badge>}
            {isOverdue && !isFrozen && <Badge className="bg-amber-500 text-white text-[10px] h-5">متأخر</Badge>}
            {isWarning && <Badge variant="secondary" className="text-[10px] h-5">قارب التجميد</Badge>}
          </div>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">المستحق للشركة (1%)</div>
          <div className="text-2xl font-extrabold text-primary">
            {row.due_amount.toFixed(2)} <span className="text-sm font-normal">ج.م</span>
          </div>
        </div>
        <div className="text-left">
          <div className="text-xs text-muted-foreground">عدد الرحلات</div>
          <div className="text-lg font-bold">{row.unpaid_count}</div>
          {row.days_overdue > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              منذ {row.days_overdue} يوم
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          onClick={onPay}
          disabled={acting || row.due_amount === 0}
          className="gap-1.5"
        >
          <CheckCircle2 className="h-4 w-4" /> تم الدفع
        </Button>
        {isFrozen ? (
          <Button size="sm" variant="outline" onClick={onReactivate} disabled={acting} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> تفعيل
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onSuspend}
            disabled={acting}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Pause className="h-4 w-4" /> إيقاف
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemind}
          disabled={acting || row.due_amount === 0}
          className="col-span-2 gap-1.5 text-amber-600 hover:bg-amber-500/10"
        >
          <BellRing className="h-4 w-4" /> إرسال تذكير
        </Button>
      </div>
    </Card>
  );
}
