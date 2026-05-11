import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAnalyticsOverview } from "@/lib/live-tracking.functions";
import { LiveMap } from "@/components/admin/LiveMap";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, Users, Car, Star, Wallet } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fetchData = useServerFn(getAnalyticsOverview);
  const [days, setDays] = useState(7);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setData(null);
    fetchData({ data: { days } }).then(setData);
  }, [days]);

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  const k = data.kpi;
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> الإحصائيات والأداء</h2>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList className="h-8">
            <TabsTrigger value="1" className="text-xs">اليوم</TabsTrigger>
            <TabsTrigger value="7" className="text-xs">7 أيام</TabsTrigger>
            <TabsTrigger value="30" className="text-xs">30 يوم</TabsTrigger>
            <TabsTrigger value="90" className="text-xs">90 يوم</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Car} label="إجمالي الرحلات" value={k.total_rides} />
        <Kpi icon={Car} label="مكتملة" value={k.completed_rides} accent="text-green-600" />
        <Kpi icon={Wallet} label="الإيرادات" value={`${k.revenue.toFixed(0)} ج.م`} />
        <Kpi icon={Users} label="سائق نشط" value={k.active_drivers} />
        <Kpi icon={Users} label="سائق متاح" value={k.available_drivers} accent="text-green-600" />
        <Kpi icon={Star} label="متوسط التقييم" value={k.avg_rating ? k.avg_rating.toFixed(2) : "—"} accent="text-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">الرحلات اليومية</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="rides" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">الإيرادات اليومية</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-bold text-sm">خريطة كثافة الطلبات (Heatmap)</h3>
          <p className="text-xs text-muted-foreground mt-1">{data.heatmap.length} نقطة طلب خلال آخر {days} يوم</p>
        </div>
        <div className="h-[480px]">
          <LiveMap drivers={[]} heatPoints={data.heatmap} />
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`text-xl font-extrabold mt-1 ${accent ?? ""}`}>{value}</div>
    </Card>
  );
}
