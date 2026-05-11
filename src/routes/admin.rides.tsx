import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/admin/rides")({
  component: RidesAdmin,
});

const STATUS_BADGE: Record<string, string> = {
  searching: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  accepted: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};
const STATUS_LABEL: Record<string, string> = {
  searching: "بحث", accepted: "مقبولة", in_progress: "جارية", completed: "مكتملة", cancelled: "ملغاة",
};

function RidesAdmin() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("week");
  const [q, setQ] = useState("");
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());

  const load = async () => {
    setLoading(true);
    const now = new Date();
    let since: Date | null = null;
    if (range === "today") { since = new Date(now); since.setHours(0, 0, 0, 0); }
    else if (range === "week") { since = new Date(now); since.setDate(since.getDate() - 7); }
    else if (range === "month") { since = new Date(now); since.setMonth(since.getMonth() - 1); }

    let query = supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(500);
    if (since) query = query.gte("created_at", since.toISOString());
    const { data } = await query;
    const ids = new Set<string>();
    (data ?? []).forEach((r) => { ids.add(r.rider_id); if (r.driver_id) ids.add(r.driver_id); });
    const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", [...ids]);
    setProfiles(new Map(profs?.map((p) => [p.id, p]) ?? []));
    setRides(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [range]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rides;
    const s = q.toLowerCase();
    return rides.filter((r) => {
      const rider = profiles.get(r.rider_id);
      const driver = r.driver_id ? profiles.get(r.driver_id) : null;
      return r.id.includes(s) ||
        (rider?.full_name || "").toLowerCase().includes(s) ||
        (driver?.full_name || "").toLowerCase().includes(s);
    });
  }, [rides, q, profiles]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث برقم الرحلة أو اسم الراكب/السائق" className="pr-9" />
        </div>
        <div className="flex gap-1">
          {(["today", "week", "month", "all"] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                range === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"
              }`}>
              {{ today: "اليوم", week: "الأسبوع", month: "الشهر", all: "الكل" }[r]}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">لا توجد رحلات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-right p-3 font-semibold">#</th>
                  <th className="text-right p-3 font-semibold">الراكب</th>
                  <th className="text-right p-3 font-semibold">السائق</th>
                  <th className="text-right p-3 font-semibold hidden md:table-cell">من → إلى</th>
                  <th className="text-right p-3 font-semibold">السعر</th>
                  <th className="text-right p-3 font-semibold">الحالة</th>
                  <th className="text-right p-3 font-semibold hidden lg:table-cell">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const rider = profiles.get(r.rider_id);
                  const driver = r.driver_id ? profiles.get(r.driver_id) : null;
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">#{r.id.slice(0, 6)}</td>
                      <td className="p-3 font-semibold">{rider?.full_name ?? "—"}</td>
                      <td className="p-3">{driver?.full_name ?? <span className="text-muted-foreground text-xs">لم يُعيَّن</span>}</td>
                      <td className="p-3 hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">{r.pickup_address} ← {r.destination_address}</td>
                      <td className="p-3 font-bold text-primary">{Number(r.price).toFixed(0)} ج.م</td>
                      <td className="p-3"><Badge variant="outline" className={STATUS_BADGE[r.status] + " border"}>{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                      <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
