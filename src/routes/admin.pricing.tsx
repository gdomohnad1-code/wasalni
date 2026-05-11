import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RIDE_TYPES, calcPrice, type RideTypeKey, type TripMode } from "@/lib/pricing";
import { Save, RotateCcw, Calculator } from "lucide-react";

export const Route = createFileRoute("/admin/pricing")({
  component: PricingAdmin,
});

type Settings = {
  oneway_base: number; oneway_base_km: number; oneway_per_km: number;
  roundtrip_base: number; roundtrip_base_km: number; roundtrip_per_km: number;
  multistop_hourly: number; multistop_min: number;
  commission_rate: number;
  multipliers: Record<string, number>;
};

const DEFAULTS: Settings = {
  oneway_base: 30, oneway_base_km: 3, oneway_per_km: 3,
  roundtrip_base: 60, roundtrip_base_km: 6, roundtrip_per_km: 3,
  multistop_hourly: 200, multistop_min: 75,
  commission_rate: 0.01,
  multipliers: { private: 1, vip: 1.5, package: 1, shared: 0.6, female: 1.4 },
};

function PricingAdmin() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKm, setPreviewKm] = useState(10);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("pricing_settings" as any).select("*").eq("id","default").maybeSingle();
    if (error) toast.error(error.message);
    if (data) {
      const d: any = data;
      setS({
        oneway_base: Number(d.oneway_base),
        oneway_base_km: Number(d.oneway_base_km),
        oneway_per_km: Number(d.oneway_per_km),
        roundtrip_base: Number(d.roundtrip_base),
        roundtrip_base_km: Number(d.roundtrip_base_km),
        roundtrip_per_km: Number(d.roundtrip_per_km),
        multistop_hourly: Number(d.multistop_hourly),
        multistop_min: Number(d.multistop_min),
        commission_rate: Number(d.commission_rate),
        multipliers: d.multipliers || DEFAULTS.multipliers,
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("pricing_settings" as any).update({
      ...s,
      updated_at: new Date().toISOString(),
    }).eq("id", "default");
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("تم حفظ الإعدادات وتطبيقها فورًا ✨");
  };

  const reset = () => { setS(DEFAULTS); toast.info("تمت استعادة القيم الافتراضية — اضغط حفظ"); };

  // Apply current form values to preview without persisting
  const previewPrice = (type: RideTypeKey, mode: TripMode) => {
    const m = s.multipliers[type] ?? 1;
    if (mode === "multistop") {
      const mins = Math.max(5, Math.round(previewKm * 2.5));
      return Math.max(s.multistop_min, Math.round((mins/60) * s.multistop_hourly * m));
    }
    if (mode === "roundtrip") {
      const extra = Math.max(0, previewKm*2 - s.roundtrip_base_km);
      return Math.round((s.roundtrip_base + extra * s.roundtrip_per_km) * m);
    }
    const extra = Math.max(0, previewKm - s.oneway_base_km);
    return Math.round((s.oneway_base + extra * s.oneway_per_km) * m);
  };

  if (loading) return <div className="text-center py-10 text-muted-foreground">جارٍ التحميل…</div>;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">إعدادات التسعير</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4 ml-1" /> افتراضي</Button>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 ml-1" /> حفظ</Button>
        </div>
      </div>

      <Section title="رحلة باتجاه واحد (Oneway)">
        <Num label="سعر الانطلاق (ج.م)" v={s.oneway_base} on={(v)=>setS({...s, oneway_base:v})} />
        <Num label="كم مجاني داخل الانطلاق" v={s.oneway_base_km} on={(v)=>setS({...s, oneway_base_km:v})} />
        <Num label="سعر الكيلومتر الإضافي" v={s.oneway_per_km} on={(v)=>setS({...s, oneway_per_km:v})} />
      </Section>

      <Section title="رحلة ذهاب وعودة (Round Trip)">
        <Num label="سعر الانطلاق" v={s.roundtrip_base} on={(v)=>setS({...s, roundtrip_base:v})} />
        <Num label="كم مجاني داخل الانطلاق" v={s.roundtrip_base_km} on={(v)=>setS({...s, roundtrip_base_km:v})} />
        <Num label="سعر الكيلومتر الإضافي" v={s.roundtrip_per_km} on={(v)=>setS({...s, roundtrip_per_km:v})} />
      </Section>

      <Section title="رحلة بالساعة / متعدد المحطات">
        <Num label="سعر الساعة" v={s.multistop_hourly} on={(v)=>setS({...s, multistop_hourly:v})} />
        <Num label="الحد الأدنى للسعر" v={s.multistop_min} on={(v)=>setS({...s, multistop_min:v})} />
      </Section>

      <Section title="عمولة المنصة">
        <Num label="نسبة العمولة (مثال 0.01 = 1%)" v={s.commission_rate} step={0.005} on={(v)=>setS({...s, commission_rate:v})} />
        <div className="text-sm text-muted-foreground self-center">= {(s.commission_rate*100).toFixed(2)}%</div>
      </Section>

      <Section title="معاملات أنواع الخدمات">
        {(Object.keys(RIDE_TYPES) as RideTypeKey[]).map((k) => (
          <Num key={k}
            label={`${RIDE_TYPES[k].icon} ${RIDE_TYPES[k].label}`}
            v={s.multipliers[k] ?? 1}
            step={0.05}
            on={(v) => setS({ ...s, multipliers: { ...s.multipliers, [k]: v } })}
          />
        ))}
      </Section>

      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-5 w-5 text-primary" />
          <h3 className="font-bold">معاينة فورية</h3>
          <div className="ms-auto flex items-center gap-2">
            <Label className="text-xs">المسافة (كم)</Label>
            <Input type="number" className="w-24" value={previewKm} onChange={(e)=>setPreviewKm(Number(e.target.value)||0)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          {(["oneway","roundtrip","multistop"] as TripMode[]).map((mode) => (
            <div key={mode} className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-2">{mode === "oneway" ? "ذهاب فقط" : mode === "roundtrip" ? "ذهاب وعودة" : "بالساعة"}</div>
              {(Object.keys(RIDE_TYPES) as RideTypeKey[]).map((k) => (
                <div key={k} className="flex justify-between py-1">
                  <span>{RIDE_TYPES[k].icon} {RIDE_TYPES[k].short}</span>
                  <span className="font-bold font-mono">{previewPrice(k, mode)} ج.م</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">يحسب السعر بنفس الصيغة المطبّقة في تطبيق الراكب — أي تعديل يُحفظ يطبَّق فوراً على كل المستخدمين.</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <h3 className="font-bold mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}
function Num({ label, v, on, step=1 }:{ label:string; v:number; on:(n:number)=>void; step?:number }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={v} onChange={(e)=>on(Number(e.target.value))} />
    </div>
  );
}
