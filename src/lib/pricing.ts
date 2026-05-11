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

// عمولة المنصة على كل رحلة
export const PLATFORM_COMMISSION_RATE = 0.01; // 1%

// مسافة وزمن
export function calcDuration(distanceKm: number): number {
  return Math.max(5, Math.round(distanceKm * 2.5));
}

export function fakeDistance(from: string, to: string): number {
  const seed = (from + to).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Math.round((3 + (seed % 18) + (seed % 7) * 0.3) * 10) / 10;
}

// المسافة الحقيقية بين نقطتين (Haversine) — كم
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
  // معامل تصحيح بسيط لمسارات الشوارع (≈1.25 من مسافة الطيران)
  return Math.round(km * 1.25 * 10) / 10;
}

/**
 * حساب السعر:
 *  - oneway:    30 ج.م أول 3 كم + 3 ج.م لكل كم زيادة
 *  - roundtrip: 60 ج.م أول 6 كم + 3 ج.م لكل كم زيادة (المسافة هنا = ذهاب فقط)
 *  - multistop: 200 ج.م لكل ساعة — أقل سعر 75 ج.م
 *  ثم يُضرب في معامل نوع الخدمة.
 */
export function calcPrice(
  distanceKm: number,
  type: RideTypeKey,
  mode: TripMode = "oneway",
  durationMin?: number,
): number {
  const m = RIDE_TYPES[type].multiplier;

  if (mode === "multistop") {
    const mins = durationMin ?? calcDuration(distanceKm);
    const hourly = (mins / 60) * 200;
    return Math.max(75, Math.round(hourly * m));
  }

  if (mode === "roundtrip") {
    const extra = Math.max(0, distanceKm * 2 - 6);
    return Math.round((60 + extra * 3) * m);
  }

  // oneway
  const extra = Math.max(0, distanceKm - 3);
  return Math.round((30 + extra * 3) * m);
}

export function calcCommission(price: number): number {
  return Math.round(price * PLATFORM_COMMISSION_RATE * 100) / 100;
}
