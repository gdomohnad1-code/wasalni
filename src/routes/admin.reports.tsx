import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, TrendingUp, Wallet, Percent, Trophy } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsAdmin,
});

const COMMISSION = 0.15; // 15%

function ReportsAdmin() {
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState(0);
  const [weekly, setWeekly] = useState(0);
  const [commission, setCommission] = useState(0);
  const [chart, setChart] = useState<{ month: string; revenue: number }[]>([]);
  const [topDrivers, setTopDrivers] = useState<{ name: string; avatar: string | null; trips: number; earnings: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date();
      const startWeek = new Date(now); startWeek.setDate(startWeek.getDate() - 7);
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startSixMonths = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const { data: completed } = await supabase
        .from("rides").select("price, created_at, driver_id")
        .eq("status", "completed")
        .gte("created_at", startSixMonths.toISOString());

      const all = completed ?? [];
      const monthRev = all.filter((r) => new Date(r.created_at) >= startMonth).reduce((s, r) => s + Number(r.price || 0), 0);
      const weekRev = all.filter((r) => new Date(r.created_at) >= startWeek).reduce((s, r) => s + Number(r.price || 0), 0);
      setMonthly(monthRev); setWeekly(weekRev); setCommission(monthRev * COMMISSION);

      const buckets: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets[d.toISOString().slice(0, 7)] = 0;
      }
      all.forEach((r) => {
        const k = new Date(r.created_at).toISOString().slice(0, 7);
        if (k in buckets) buckets[k] += Number(r.price || 0);
      });
      setChart(Object.entries(buckets).map(([k, v]) => ({
        month: new Date(k + "-01").toLocaleDateString("ar-EG", { month: "short" }),
        revenue: Math.round(v),
      })));

      const driverAgg = new Map<string, { trips: number; earnings: number }>();
      all.forEach((r) => {
        if (!r.driver_id) return;
        const cur = driverAgg.get(r.driver_id) ?? { trips: 0, earnings: 0 };
        cur.trips++; cur.earnings += Number(r.price || 0) * (1 - COMMISSION);
        driverAgg.set(r.driver_id, cur);
      });
      const top = [...driverAgg.entries()].sort((a, b) => b[1].trips - a[1].trips).slice(0, 10);
      const ids = top.map(([id]) => id);
      const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);
      const pmap = new Map(profs?.map((p) => [p.id, p]) ?? []);
      setTopDrivers(top.map(([id, v]) => ({
        name: pmap.get(id)?.full_name ?? "—",
        avatar: pmap.get(id)?.avatar_url ?? null,
        trips: v.trips,
        earnings: v.earnings,
      })));
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-5"><div className="flex items-center gap-3 mb-2"><div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center"><Wallet className="h-5 w-5 text-primary" /></div><div className="text-sm text-muted-foreground">إيرادات الشهر</div></div><div className="text-3xl font-extrabold">{monthly.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">ج.م</span></div></Card>
        <Card className="p-5"><div className="flex items-center gap-3 mb-2"><div className="h-10 w-10 rounded-lg bg-blue-500/10 grid place-items-center"><TrendingUp className="h-5 w-5 text-blue-600" /></div><div className="text-sm text-muted-foreground">إيرادات الأسبوع</div></div><div className="text-3xl font-extrabold">{weekly.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">ج.م</span></div></Card>
        <Card className="p-5"><div className="flex items-center gap-3 mb-2"><div className="h-10 w-10 rounded-lg bg-emerald-500/10 grid place-items-center"><Percent className="h-5 w-5 text-emerald-600" /></div><div className="text-sm text-muted-foreground">عمولة الشهر ({(COMMISSION * 100).toFixed(0)}%)</div></div><div className="text-3xl font-extrabold">{commission.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">ج.م</span></div></Card>
      </div>

      <Card className="p-4">
        <h3 className="font-bold mb-4">الإيرادات في آخر 6 أشهر</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h3 className="font-bold">أفضل 10 سائقين (حسب عدد الرحلات)</h3>
        </div>
        {topDrivers.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">لا توجد بيانات بعد</p>
        ) : (
          <div className="space-y-2">
            {topDrivers.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/60">
                <div className={`h-8 w-8 rounded-full grid place-items-center font-bold text-sm shrink-0 ${
                  i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-300 text-gray-800" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
                }`}>{i + 1}</div>
                <Avatar className="h-9 w-9"><AvatarImage src={d.avatar ?? undefined} /><AvatarFallback>{d.name[0]}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.trips} رحلة</div>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{d.earnings.toFixed(0)} ج.م</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
