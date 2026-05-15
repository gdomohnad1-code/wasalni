import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Users, Wallet, MessageSquareWarning, UserCircle, Loader2, TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { motion } from "framer-motion";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

type Stats = {
  ridesToday: number;
  ridesMonth: number;
  revenue: number;
  activeDrivers: number;
  openComplaints: number;
  totalRiders: number;
};

function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<{ date: string; rides: number }[]>([]);
  const [live, setLive] = useState<any[]>([]);
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!loadedRef.current) setLoading(true);
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const start7 = new Date(now); start7.setDate(start7.getDate() - 6); start7.setHours(0, 0, 0, 0);

    const [today, month, commissions, drivers, complaints, riders, last7, liveR] = await Promise.all([
      supabase.from("rides").select("id", { count: "exact", head: true }).gte("created_at", startToday.toISOString()),
      supabase.from("rides").select("id", { count: "exact", head: true }).gte("created_at", startMonth.toISOString()),
      supabase.from("driver_commissions").select("amount").gte("created_at", startMonth.toISOString()),
      supabase.from("driver_documents").select("driver_id", { count: "exact", head: true }).eq("approved", true).eq("account_status", "active"),
      supabase.from("complaints").select("id", { count: "exact", head: true }).in("status", ["new", "in_progress"]),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "rider"),
      supabase.from("rides").select("created_at").gte("created_at", start7.toISOString()),
      supabase.from("rides").select("id, pickup_address, destination_address, status, price, created_at, rider_id, driver_id")
        .in("status", ["searching", "accepted", "in_progress"])
        .order("created_at", { ascending: false }).limit(5),
    ]);

    const totalRev = (commissions.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const buckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = 0;
    }
    (last7.data ?? []).forEach((r: any) => {
      const k = new Date(r.created_at).toISOString().slice(0, 10);
      if (k in buckets) buckets[k]++;
    });
    setChart(Object.entries(buckets).map(([date, rides]) => ({
      date: new Date(date).toLocaleDateString("ar-EG", { weekday: "short" }),
      rides,
    })));

    setStats({
      ridesToday: today.count ?? 0,
      ridesMonth: month.count ?? 0,
      revenue: totalRev,
      activeDrivers: drivers.count ?? 0,
      openComplaints: complaints.count ?? 0,
      totalRiders: riders.count ?? 0,
    });
    setLive(liveR.data ?? []);
    loadedRef.current = true;
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (loading || !stats) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const cards = [
    { label: "رحلات اليوم", value: stats.ridesToday, icon: Car, color: "from-primary to-primary/70", to: "/admin/rides" as const },
    { label: "رحلات الشهر", value: stats.ridesMonth, icon: TrendingUp, color: "from-blue-500 to-blue-400", to: "/admin/rides" as const },
    { label: "عمولة الشركة (الشهر)", value: `${stats.revenue.toFixed(0)} ج.م`, icon: Wallet, color: "from-emerald-500 to-emerald-400", to: "/admin/analytics" as const },
    { label: "سائقون نشطون", value: stats.activeDrivers, icon: Users, color: "from-violet-500 to-violet-400", to: "/admin/drivers" as const },
    { label: "شكاوى مفتوحة", value: stats.openComplaints, icon: MessageSquareWarning, color: "from-orange-500 to-orange-400", to: "/admin/complaints" as const },
    { label: "إجمالي الركاب", value: stats.totalRiders, icon: UserCircle, color: "from-pink-500 to-pink-400", to: "/admin/riders" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={c.to} className="block">
                <Card className="p-4 relative overflow-hidden cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40">
                  <div className={`absolute -top-6 -left-6 h-20 w-20 rounded-full bg-gradient-to-br ${c.color} opacity-10`} />
                  <Icon className="h-5 w-5 text-muted-foreground mb-2" />
                  <div className="text-2xl font-extrabold">{c.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">الرحلات في آخر 7 أيام</h3>
          <Badge variant="outline">{chart.reduce((s, c) => s + c.rides, 0)} رحلة</Badge>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="rides" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#g1)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">رحلات جارية الآن</h3>
          <Link to="/admin/rides" className="text-xs text-primary font-semibold hover:underline">عرض الكل</Link>
        </div>
        {live.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">لا توجد رحلات جارية حالياً</p>
        ) : (
          <div className="space-y-2">
            {live.map((r) => (
              <Link
                key={r.id}
                to="/admin/live"
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/60 transition hover:bg-muted/60 hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{r.pickup_address} ← {r.destination_address}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleTimeString("ar-EG")}</div>
                </div>
                <div className="text-left shrink-0">
                  <div className="text-sm font-bold">{Number(r.price).toFixed(0)} ج.م</div>
                  <Badge variant="secondary" className="text-[10px] mt-0.5">{r.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
