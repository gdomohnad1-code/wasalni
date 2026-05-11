import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useServerFn } from "@tanstack/react-start";
import { listGeofences, saveGeofence, deleteGeofence } from "@/lib/live-tracking.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Save, X, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/geofences")({
  component: GeofencesPage,
});

function GeofencesPage() {
  const fetchZones = useServerFn(listGeofences);
  const saveZone = useServerFn(saveGeofence);
  const delZone = useServerFn(deleteGeofence);

  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<Array<[number, number]>>([]); // [lat,lng]
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawLayerRef = useRef<L.LayerGroup | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);

  const load = () => fetchZones().then((r) => { setZones(r.zones ?? []); setLoading(false); });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // init map
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current).setView([30.0444, 31.2357], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    drawLayerRef.current = L.layerGroup().addTo(map);
    zonesLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // draw on click when in drawing mode
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      if (!drawing) return;
      setPoints((p) => [...p, [e.latlng.lat, e.latlng.lng]]);
    };
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [drawing]);

  // render in-progress drawing
  useEffect(() => {
    const layer = drawLayerRef.current; if (!layer) return;
    layer.clearLayers();
    points.forEach((p, i) => L.circleMarker(p, { radius: 5, color, fillOpacity: 1 }).addTo(layer).bindTooltip(String(i + 1)));
    if (points.length >= 2) L.polyline([...points, ...(points.length >= 3 ? [points[0]] : [])], { color, weight: 2, dashArray: "4 4" }).addTo(layer);
    if (points.length >= 3) L.polygon(points, { color, fillOpacity: 0.15 }).addTo(layer);
  }, [points, color]);

  // render existing zones
  useEffect(() => {
    const layer = zonesLayerRef.current; if (!layer) return;
    layer.clearLayers();
    zones.forEach((z) => {
      const coords = z.polygon?.coordinates?.[0];
      if (!coords) return;
      const latlngs: [number, number][] = coords.map((c: any) => [Number(c[1]), Number(c[0])]);
      const poly = L.polygon(latlngs, { color: z.color || "#3b82f6", weight: 2, fillOpacity: 0.12, dashArray: z.active === false ? "6 6" : undefined });
      poly.bindTooltip(z.name);
      layer.addLayer(poly);
    });
  }, [zones]);

  const startDraw = () => { setDrawing(true); setPoints([]); setName(""); };
  const cancelDraw = () => { setDrawing(false); setPoints([]); };
  const undoPoint = () => setPoints((p) => p.slice(0, -1));

  const save = async () => {
    if (!name.trim()) return toast.error("ادخل اسم المنطقة");
    if (points.length < 3) return toast.error("اختر 3 نقاط على الأقل");
    // Close polygon and convert to GeoJSON [lng,lat]
    const ring = [...points, points[0]].map(([lat, lng]) => [lng, lat]);
    const polygon = { type: "Polygon", coordinates: [ring] };
    await saveZone({ data: { name: name.trim(), polygon: polygon as any, color, active: true } });
    toast.success("تم حفظ المنطقة");
    setDrawing(false); setPoints([]); setName("");
    load();
  };

  const toggleActive = async (z: any) => {
    await saveZone({ data: { id: z.id, name: z.name, polygon: z.polygon, color: z.color, active: !z.active } });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف المنطقة؟")) return;
    await delZone({ data: { id } });
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> مناطق التوصيل</h2>
        {!drawing ? (
          <Button onClick={startDraw} className="gap-1.5"><Plus className="h-4 w-4" /> إضافة منطقة</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={undoPoint} disabled={points.length === 0} size="sm">تراجع نقطة</Button>
            <Button variant="ghost" onClick={cancelDraw} size="sm" className="gap-1"><X className="h-4 w-4" /> إلغاء</Button>
          </div>
        )}
      </div>

      {drawing && (
        <Card className="p-3 bg-primary/5 border-primary/30">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2 items-center">
            <Input placeholder="اسم المنطقة" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded border" />
            <Button onClick={save} className="gap-1.5"><Save className="h-4 w-4" /> حفظ ({points.length} نقاط)</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">انقر على الخريطة لإضافة نقاط (3 على الأقل لإغلاق المضلع).</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="p-0 overflow-hidden">
          <div ref={mapElRef} className="w-full h-[600px]" />
        </Card>
        <Card className="p-3 max-h-[600px] overflow-y-auto space-y-2">
          <h3 className="font-bold text-sm mb-1">المناطق ({zones.length})</h3>
          {zones.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">لا توجد مناطق بعد.</p>}
          {zones.map((z) => (
            <div key={z.id} className="border rounded-lg p-2.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: z.color || "#3b82f6" }} />
                <div className="font-bold text-sm flex-1 truncate">{z.name}</div>
                {z.active ? <Badge className="h-4 text-[9px] px-1">مفعلة</Badge> : <Badge variant="secondary" className="h-4 text-[9px] px-1">معطلة</Badge>}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <Switch checked={!!z.active} onCheckedChange={() => toggleActive(z)} />
                  <span className="text-[10px] text-muted-foreground">تفعيل</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => remove(z.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
