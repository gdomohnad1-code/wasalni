import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setPricingConfig, getPricingConfig, type PricingConfig } from "@/lib/pricing";

export function usePricingSync() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const apply = (row: any) => {
      if (!row) return;
      setPricingConfig({
        oneway_base: Number(row.oneway_base),
        oneway_base_km: Number(row.oneway_base_km),
        oneway_per_km: Number(row.oneway_per_km),
        roundtrip_base: Number(row.roundtrip_base),
        roundtrip_base_km: Number(row.roundtrip_base_km),
        roundtrip_per_km: Number(row.roundtrip_per_km),
        multistop_hourly: Number(row.multistop_hourly),
        multistop_min: Number(row.multistop_min),
        commission_rate: Number(row.commission_rate),
        multipliers: row.multipliers || {},
      } as Partial<PricingConfig>);
      setLoaded(true);
    };
    supabase.from("pricing_settings" as any).select("*").eq("id", "default").maybeSingle()
      .then(({ data }) => apply(data));
    const ch = supabase
      .channel("pricing-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "pricing_settings" }, (p: any) => apply(p.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return { loaded, config: getPricingConfig() };
}
