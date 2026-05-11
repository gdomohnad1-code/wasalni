// تسعيرة الخدمات — وصلني
export const RIDE_TYPES = {
  private: {
    label: "وصلني عادي",
    short: "عادي",
    icon: "🚕",
    desc: "سيارة عادية لرحلتك اليومية",
    multiplier: 1,
    accent: "from-primary/20 to-primary/5",
  },
  vip: {
    label: "وصلني مميز",
    short: "مميز",
    icon: "🌟",
    desc: "سيارات فخمة وراحة استثنائية",
    multiplier: 1.5,
    accent: "from-amber-400/30 to-amber-200/5",
  },
  package: {
    label: "وصلي طرد",
    short: "طرد",
    icon: "📦",
    desc: "توصيل من باب لباب — حتى 30 كجم",
    multiplier: 1,
    accent: "from-orange-400/25 to-orange-200/5",
  },
  shared: {
    label: "سكوتر",
    short: "سكوتر",
    icon: "🛵",
    desc: "أسرع وأرخص للمشاوير القصيرة",
    multiplier: 0.6,
    accent: "from-emerald-400/25 to-emerald-200/5",
  },
  female: {
    label: "فان",
    short: "فان",
    icon: "🚐",
    desc: "للمجموعات والعائلات والأمتعة",
    multiplier: 1.4,
    accent: "from-sky-400/25 to-sky-200/5",
  },
} as const;

export type RideTypeKey = keyof typeof RIDE_TYPES;
export type TripMode = "oneway" | "roundtrip" | "multistop";

export type PricingConfig = {
  oneway_base: number;
  oneway_base_km: number;
  oneway_per_km: number;
  roundtrip_base: number;
  roundtrip_base_km: number;
  roundtrip_per_km: number;
  multistop_hourly: number;
  multistop_min: number;
  commission_rate: number;
  multipliers: Partial<Record<RideTypeKey, number>>;
};

const DEFAULT_CONFIG: PricingConfig = {
  oneway_base: 30,
  oneway_base_km: 3,
  oneway_per_km: 3,
  roundtrip_base: 60,
  roundtrip_base_km: 6,
  roundtrip_per_km: 3,
  multistop_hourly: 200,
  multistop_min: 75,
  commission_rate: 0.01,
  multipliers: { private: 1, vip: 1.5, package: 1, shared: 0.6, female: 1.4 },
};

let CONFIG: PricingConfig = { ...DEFAULT_CONFIG };
export let PLATFORM_COMMISSION_RATE = CONFIG.commission_rate;

export function setPricingConfig(cfg: Partial<PricingConfig>) {
  CONFIG = { ...CONFIG, ...cfg, multipliers: { ...DEFAULT_CONFIG.multipliers, ...(cfg.multipliers || {}) } };
  PLATFORM_COMMISSION_RATE = CONFIG.commission_rate;
}
export function getPricingConfig(): PricingConfig {
  return CONFIG;
}

// مسافة وزمن
export function calcDuration(distanceKm: number): number {
  return Math.max(5, Math.round(distanceKm * 2.5));
}

export function fakeDistance(from: string, to: string): number {
  const seed = (from + to).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Math.round((3 + (seed % 18) + (seed % 7) * 0.3) * 10) / 10;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const km = 2 * R * Math.asin(Math.sqrt(h));
  return Math.round(km * 1.25 * 10) / 10;
}

export function calcPrice(
  distanceKm: number,
  type: RideTypeKey,
  mode: TripMode = "oneway",
  durationMin?: number,
): number {
  const c = CONFIG;
  const m = c.multipliers[type] ?? RIDE_TYPES[type].multiplier;

  if (mode === "multistop") {
    const mins = durationMin ?? calcDuration(distanceKm);
    const hourly = (mins / 60) * c.multistop_hourly;
    return Math.max(c.multistop_min, Math.round(hourly * m));
  }

  if (mode === "roundtrip") {
    const extra = Math.max(0, distanceKm * 2 - c.roundtrip_base_km);
    return Math.round((c.roundtrip_base + extra * c.roundtrip_per_km) * m);
  }

  const extra = Math.max(0, distanceKm - c.oneway_base_km);
  return Math.round((c.oneway_base + extra * c.oneway_per_km) * m);
}

export function calcCommission(price: number): number {
  return Math.round(price * CONFIG.commission_rate * 100) / 100;
}
